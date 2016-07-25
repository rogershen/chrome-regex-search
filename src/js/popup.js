/*** CONSTANTS ***/
var DEFAULT_INSTANT_RESULTS = true;
var DEFAULT_CASE_INSENSITIVE = false;
var ERROR_COLOR = '#ff8989';
var WHITE_COLOR = '#ffffff';
var ERROR_TEXT = "Content script was not loaded. Are you currently in the Chrome Web Store or in a chrome:// page? If you are, content scripts won't work here. If not, please wait for the page to finish loading or refresh the page.";
/*** CONSTANTS ***/

/*** VARIABLES ***/
var sentInput = false;  // true => Enter goes to next match
var searchIsInProgress = false; // true => we're waiting for content.js to
                                // process the current search.
/*** VARIABLES ***/

/*** FUNCTIONS ***/

/* Validate that a given pattern string is a valid regex.
   Returns boolean valid/invalid.  */
function isValidRegex(pattern) {
  try{  // don't care whether it's case sensitive.
    var regex = new RegExp(pattern);
    return true;
  } catch(e) {
    return false;
  }
}

/* Send message to content script of tab to select next result */
function selectNext(){
  chrome.tabs.query({
    'active': true,
    'currentWindow': true
  },
  function(tabs) {
    if ('undefined' != typeof tabs[0].id && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        'message' : 'selectNextNode'
      });
    }
  });
}

/* Send message to content script of tab to select previous result */
function selectPrev(){
  chrome.tabs.query({
    'active': true,
    'currentWindow': true
  },
  function(tabs) {
    if ('undefined' != typeof tabs[0].id && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        'message' : 'selectPrevNode'
      });
    }
  });
}

/* Send message to pass input string to content script of tab to
   find and highlight regex matches.  No-op if the content script is
   already processing a search. */
function passInputToContentScript() {
  if (!searchIsInProgress) {
    var regexString = document.getElementById('inputRegex').value;
    var isCaseInsensitive=document.getElementById('cbCaseInsensitive').checked;

    if  (!isValidRegex(regexString)) {
      document.getElementById('inputRegex').style.backgroundColor = ERROR_COLOR;
      // but still send the erroneous regex to the content script so the
      // result count will be zeroed.
    } else {
      document.getElementById('inputRegex').style.backgroundColor = WHITE_COLOR;
    }

    chrome.tabs.query(
      { 'active': true, 'currentWindow': true },
      function(tabs) {
        if ('undefined' != typeof tabs[0].id && tabs[0].id) {
          searchIsInProgress = true;
          chrome.tabs.sendMessage(tabs[0].id, {
            'message' : 'search',
            'regexString' : (isCaseInsensitive ? "(?i)" : "") + regexString,
              // Use a mode modifier so changes to the case-sensitivity
              // will be reflected in a change to the query.  Also provides
              // for future expansion of the modes.
            'getNext' : true
          });
          sentInput = true;
        }
      }
    );
  } //endif not searchIsInProgress
}

/*** LISTENERS ***/
document.getElementById('next').addEventListener('click', function() {
  selectNext();
});

document.getElementById('prev').addEventListener('click', function() {
  selectPrev();
});

document.getElementById('clear').addEventListener('click', function() {
  sentInput = false;
  document.getElementById('inputRegex').value = '';
  passInputToContentScript();
  document.getElementById('inputRegex').focus();
});

/* Received returnSearchInfo message, populate popup UI */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('returnSearchInfo' == request.message) {
    var regexinfo = splitRegexString(request.regexString);
      // chop mode modifiers, if any.
    var requestIsInsens = ("i" in regexinfo);
    var dlgIsInsens = document.getElementById('cbCaseInsensitive').checked;

    searchIsInProgress = false;
    if (request.numResults > 0) {
      document.getElementById('numResults').textContent = String(request.currentSelection+1) + ' of ' + String(request.numResults);
    } else {
      document.getElementById('numResults').textContent = String(request.currentSelection) + ' of ' + String(request.numResults);
    }
    if (!sentInput) {
      document.getElementById('inputRegex').value = regexinfo.str;
      document.getElementById('cbCaseInsensitive').checked = ("i" in regexinfo);
    }
    if ( (regexinfo.str !== document.getElementById('inputRegex').value) ||
         (requestIsInsens != dlgIsInsens) ) {
      passInputToContentScript();
    }
  }
});

/* Key listener for selectNext and selectPrev
 * Thanks a lot to http://stackoverflow.com/users/1175714/braden-best for this
 * technique.  http://stackoverflow.com/a/12444641/2877364
 */
var MAP_SHIFT = 16;
var MAP_ENTER = 13;
var map = [];
onkeydown = onkeyup = function(e) {
    map[e.keyCode] = (e.type == 'keydown');
    if (document.getElementById('inputRegex') === document.activeElement) { //input element is in focus
      if (!map[MAP_SHIFT] && map[MAP_ENTER]) {        // Enter
        if (sentInput) {
          selectNext();
        } else {
          passInputToContentScript();
        }
      } else if (map[MAP_SHIFT] && map[MAP_ENTER]) {  // Shift+Enter
        selectPrev();
      }
    }
}
/*** LISTENERS ***/

/*** INIT ***/
/* Retrieve from storage whether we should use instant results or not.
   Set the event listeners for the regex and case-sensitive checkboxes
   accordingly. */
chrome.storage.local.get({
  'instantResults' : DEFAULT_INSTANT_RESULTS },
  function(result) {
    if(result.instantResults) {
      document.getElementById('inputRegex').addEventListener(
        'input', function() {
          passInputToContentScript();
        });
      document.getElementById('cbCaseInsensitive').addEventListener(
        'change',function() {
          document.getElementById('inputRegex').focus();
          sentInput = false;  // Starting a new search, since case-sensitivity
          passInputToContentScript(); //changed.
        });
    } else {  // not instant results
      document.getElementById('inputRegex').addEventListener(
        'change', function() {  // when the user hits Enter
          passInputToContentScript();
        });
      document.getElementById('cbCaseInsensitive').addEventListener(
        'change',function() {
          document.getElementById('inputRegex').focus();
        });
    }
  }
);

/* Retrieve from storage whether we should be case-sensitive or not */
chrome.storage.local.get({
  'caseInsensitive' : DEFAULT_CASE_INSENSITIVE },
  function(result) {
    document.getElementById('cbCaseInsensitive').checked = Boolean(result);
  }
);

/* Get search info if there is any */
chrome.tabs.query(
  {
    'active': true,
    'currentWindow': true
  },
  function(tabs) {
    if ('undefined' != typeof tabs[0].id && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        'message' : 'getSearchInfo'
      }, function(response){
        if (response) {
          // Content script is active
          console.log(response);
        } else {
          console.log(response);
          document.getElementById('error').textContent = ERROR_TEXT;
        }
      });
    }
  }
);

/* Focus onto input form */
document.getElementById('inputRegex').focus();
window.setTimeout(
  function(){document.getElementById('inputRegex').select();}, 0);
//Thanks to http://stackoverflow.com/questions/480735#comment40578284_14573552

/*** INIT ***/

