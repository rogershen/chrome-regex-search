/*** CONSTANTS ***/
var DEFAULT_INSTANT_RESULTS = true;
var ERROR_COLOR = '#ff8989';
var WHITE_COLOR = '#ffffff';
var ERROR_TEXT = "Content script was not loaded. Are you currently in the Chrome Web Store or in a chrome:// page? If you are, content scripts won't work here. If not, please wait for the page to finish loading or refresh the page.";
var SHOW_HISTORY_TITLE = "Show search history";
var HIDE_HISTORY_TITLE = "Hide search history";
var HISTORY_IS_EMPTY_TEXT = "Search history is empty.";
var MAX_HISTORY_LENGTH = 30;
/*** CONSTANTS ***/

/*** VARIABLES ***/
var sentInput = false;
var processingKey = false;
var searchHistory = null;
/*** VARIABLES ***/

/*** FUNCTIONS ***/
/* Validate that a given pattern string is a valid regex */
function isValidRegex(pattern) {
  try{
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

/* Send message to pass input string to content script of tab to find and highlight regex matches */
function passInputToContentScript(){
  if (!processingKey) {
    var regexString = document.getElementById('inputRegex').value;
    if  (!isValidRegex(regexString)) {
      document.getElementById('inputRegex').style.backgroundColor = ERROR_COLOR;
    } else {
      document.getElementById('inputRegex').style.backgroundColor = WHITE_COLOR;
    }
    chrome.tabs.query({
      'active': true,
      'currentWindow': true
    },
    function(tabs) {
      if ('undefined' != typeof tabs[0].id && tabs[0].id) {
        processingKey = true;
        chrome.tabs.sendMessage(tabs[0].id, {
          'message' : 'search',
          'regexString' : regexString,
          'getNext' : true
        });
        sentInput = true;
      }
    });
  }
}

function createHistoryLineElement(text) {
  var deleteEntrySpan = document.createElement('span');
  deleteEntrySpan.className = 'historyDeleteEntry'
  deleteEntrySpan.textContent = '\u2715';
  deleteEntrySpan.addEventListener('click', function() {
    for (var i = searchHistory.length - 1; i >= 0; i--) {
      if (searchHistory[i] == text) {
        searchHistory.splice(i, 1);
      }
    }
    chrome.storage.local.set({searchHistory: searchHistory});
    updateHistoryDiv();
  });
  var linkSpan = document.createElement('span');
  linkSpan.className = 'historyLink'
  linkSpan.textContent = text;
  linkSpan.addEventListener('click', function() {
    if (document.getElementById('inputRegex').value !== text) {
      document.getElementById('inputRegex').value = text;
      passInputToContentScript();
    }
  });
  var lineDiv = document.createElement('div');
  lineDiv.appendChild(deleteEntrySpan);
  lineDiv.appendChild(linkSpan);
  return lineDiv;
}

function updateHistoryDiv() {
  var historyDiv = document.getElementById('history');
  if (historyDiv) {
    historyDiv.innerHTML = '';
    if (searchHistory.length == 0) {
      var span = document.createElement('span');
      span.className = 'historyIsEmptyMessage';
      span.textContent = HISTORY_IS_EMPTY_TEXT;
      historyDiv.appendChild(span);
    } else {
      for (var i = searchHistory.length - 1; i >= 0; i--) {
        historyDiv.appendChild(createHistoryLineElement(searchHistory[i]));
      }
    }
  }
}

function addToHistory(regex) {
  if (regex && searchHistory !== null) {
    if (searchHistory.length == 0 || searchHistory[searchHistory.length - 1] != regex) {
      searchHistory.push(regex);
    }
    for (var i = searchHistory.length - 2; i >= 0; i--) {
      if (searchHistory[i] == regex) {
        searchHistory.splice(i, 1);
      }
    }
    if (searchHistory.length > MAX_HISTORY_LENGTH) {
      searchHistory.splice(0, searchHistory.length - MAX_HISTORY_LENGTH);
    }
    chrome.storage.local.set({searchHistory: searchHistory});
    updateHistoryDiv();
  }
}

function setHistoryVisibility(makeVisible) {
  document.getElementById('history').style.display = makeVisible ? 'block' : 'none';
  document.getElementById('show-history').title = makeVisible ? HIDE_HISTORY_TITLE : SHOW_HISTORY_TITLE;
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

document.getElementById('show-history').addEventListener('click', function() {
  var makeVisible = document.getElementById('history').style.display == 'none';
  setHistoryVisibility(makeVisible);
  chrome.storage.local.set({isSearchHistoryVisible: makeVisible});
});

/* Received returnSearchInfo message, populate popup UI */ 
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('returnSearchInfo' == request.message) {
    processingKey = false;
    if (request.numResults > 0) {
      document.getElementById('numResults').textContent = String(request.currentSelection+1) + ' of ' + String(request.numResults);
    } else {
      document.getElementById('numResults').textContent = String(request.currentSelection) + ' of ' + String(request.numResults);
    }
    if (!sentInput) {
      document.getElementById('inputRegex').value = request.regexString;
    }
    if (request.numResults > 0 && request.cause == 'selectNode') {
      addToHistory(request.regexString);
    }
    if (request.regexString !== document.getElementById('inputRegex').value) {
      passInputToContentScript();
    }
  }
});

/* Key listener for selectNext and selectPrev
 * Thanks a lot to Cristy from StackOverflow for this AWESOME solution
 * http://stackoverflow.com/questions/5203407/javascript-multiple-keys-pressed-at-once */
var map = [];
onkeydown = onkeyup = function(e) {
    map[e.keyCode] = e.type == 'keydown';
    if (document.getElementById('inputRegex') === document.activeElement) { //input element is in focus
      if (!map[16] && map[13]) { //ENTER
        if (sentInput) {
          selectNext();
        } else {
          passInputToContentScript();
        }
      } else if (map[16] && map[13]) { //SHIFT + ENTER
        selectPrev();
      }
    }
}
/*** LISTENERS ***/

/*** INIT ***/
/* Retrieve from storage whether we should use instant results or not */
chrome.storage.local.get({
    'instantResults' : DEFAULT_INSTANT_RESULTS,
    'searchHistory' : null,
    'isSearchHistoryVisible' : false},
  function(result) {
    if(result.instantResults) {
      document.getElementById('inputRegex').addEventListener('input', function() {
        passInputToContentScript();
      });
    } else {
      document.getElementById('inputRegex').addEventListener('change', function() {
        passInputToContentScript();
      });
    }
    if(result.searchHistory) {
      searchHistory = result.searchHistory.slice(0);
    } else {
      searchHistory = [];
    }
    setHistoryVisibility(result.isSearchHistoryVisible);
    updateHistoryDiv();
  }
);

/* Get search info if there is any */
chrome.tabs.query({
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
});

/* Focus onto input form */
document.getElementById('inputRegex').focus();
/*** INIT ***/