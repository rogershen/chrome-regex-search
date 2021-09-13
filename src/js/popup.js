/*** CONSTANTS ***/
let DEFAULT_INSTANT_RESULTS = true;
let ERROR_COLOR = '#F8D7DA';
let WHITE_COLOR = '#ffffff';
let ERROR_TEXT = "Content script was not loaded on this url or please wait for the page to load.";
let SHOW_HISTORY_TITLE = "Show search history";
let HIDE_HISTORY_TITLE = "Hide search history";
let ENABLE_CASE_INSENSITIVE_TITLE = "Enable case insensitive search";
let DISABLE_CASE_INSENSITIVE_TITLE = "Disable case insensitive search";
let HISTORY_IS_EMPTY_TEXT = "Search history is empty.";
let CLEAR_ALL_HISTORY_TEXT = "Clear History";
let DEFAULT_CASE_INSENSITIVE = false;
let MAX_HISTORY_LENGTH = 30;
/*** CONSTANTS ***/

/*** VARIABLES ***/
let sentInput = false;
let processingKey = false;
let searchHistory = null;
let maxHistoryLength = MAX_HISTORY_LENGTH;
/*** VARIABLES ***/

/**ELEMENTS**/
let txt_regex = document.getElementById('inputRegex');
let num_results = document.getElementById('numResults');
let btn_next = document.getElementById('next');
let btn_prev = document.getElementById('prev');
let btn_flag = document.getElementById('insensitive');

/**
 * will maintain most recent maxlen items
 */
class RegExHistory {
  constructor(maxlen=maxHistoryLength) {
    this.maxlen = maxlen
    this.history = []
    this.i = 0
    chrome.storage.local.set({
      // 'instantResults': DEFAULT_INSTANT_RESULTS,
      // 'maxHistoryLength': MAX_HISTORY_LENGTH,
      'searchHistory': [],
      // 'isSearchHistoryVisible': false,
    })
  }

  is_empty() {
    return this.history.length === 0
  }

  clear() {
    this.history = []
    this.i = 0
    return this
  }

  next() {
    if(this.i >= this.history.length)
      return false
    return this.history[this.i++]
  }

  prev() {
    if(this.i <= 0)
      return false
    return this.history[this.i--]
  }

  add(item) {
    if(this.history.length >= this.maxlen) {
      this.history.pop()
    }
    this.history.unshift(item)
    return this
  }
}

class RE {
  constructor(txt, settings={
    flag_case_sensitivity: true,
    default_instant_results: true,
    current_window: true
  }) {
    this.txt = txt
    this.regex = (this.is_valid(txt)) ? new RegExp(txt) : new RegExp()
    this.settings = settings
  }

  is_valid(txt) {
    if(new RegExp(txt))
      return true
    return false
  }

  copy_results() {
    chrome.tabs.query({
      'active': true,
      'currentWindow': true
    },
    function (tabs) {
      if ('undefined' != typeof tabs[0].id && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          'message': 'copyToClipboard'
        });
      }
    });

    return this
  }

  next_result() {
    chrome.tabs.query({
      'active': true,
      'currentWindow': true
    },
    function(tabs) {
      if('undefined' != typeof tabs[0].id && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          'message' : 'selectNextNode'
        })
      }
    })

    return this
  }

  prev_result() {
    chrome.tabs.query({
      'active': true,
      'currentWindow': true
    },
    function(tabs) {
      if ('undefined' != typeof tabs[0].id && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          'message' : 'selectPrevNode'
        })
      }
    })

    return this
  }
}

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
// function passInputToContentScript(){
//   passInputToContentScript(false);
// }

function passInputToContentScript(configurationChanged) {
  if(!processingKey) {
    var regexString = txt_regex.value;
    if(!isValidRegex(regexString)) {
      txt_regex.style.backgroundColor = ERROR_COLOR;
    } else {
      txt_regex.style.backgroundColor = WHITE_COLOR;
    }
    chrome.tabs.query(
      { 'active': true, 'currentWindow': true },
      function(tabs) {
        if('undefined' != typeof tabs[0].id && tabs[0].id) {
          processingKey = true;
          chrome.tabs.sendMessage(tabs[0].id, {
            'message' : 'search',
            'regexString' : regexString,
            'configurationChanged' : configurationChanged,
            'getNext' : true
          });
          sentInput = true;
        }
        chrome.storage.local.set({lastSearch: regexString});
      }
    );
  }
}

function createHistoryLineElement(text) {
  var deleteEntrySpan = document.createElement('span');
  deleteEntrySpan.className = 'historyDeleteEntry fas fa-times'
  deleteEntrySpan.addEventListener('click', function() {
    for(let i = searchHistory.length - 1; i >= 0; i--) {
      if(searchHistory[i] == text) {
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
    if (txt_regex.value !== text) {
      txt_regex.value = text;
      passInputToContentScript();
      txt_regex.focus();
    }
  });
  var lineDiv = document.createElement('li');
  lineDiv.appendChild(deleteEntrySpan);
  lineDiv.appendChild(linkSpan);
  return lineDiv;
}

function updateHistoryDiv() {
  let historyDiv = document.getElementById('history');
  if(historyDiv) {
    historyDiv.innerHTML = '';

    // default history is empty message
    let span = document.createElement('span');
    span.className = 'historyIsEmptyMessage';
    span.textContent = HISTORY_IS_EMPTY_TEXT;
    historyDiv.appendChild(span);

    if(searchHistory.length != 0) {
      historyDiv.innerHTML = '';
      for(let i = searchHistory.length - 1; i >= 0; i--) {
        historyDiv.appendChild(createHistoryLineElement(searchHistory[i]));
      }

      // create `Clear History` button
      let clearButton = document.createElement('a');
      clearButton.href = '#';
      clearButton.type = 'button';
      clearButton.textContent = CLEAR_ALL_HISTORY_TEXT;
      clearButton.className = 'clearHistoryButton';
      clearButton.addEventListener('click', clearSearchHistory);
      historyDiv.appendChild(clearButton);
    }
  }
}

/**
 * adds search items to local storage list (after user presses enter)
 */
function addToHistory(regex) {
  if(regex && searchHistory !== null) {
    if(searchHistory.length == 0 || searchHistory[searchHistory.length - 1] != regex) {
      searchHistory.push(regex);
    }
    for(let i = searchHistory.length - 2; i >= 0; i--) {
      if(searchHistory[i] == regex) {
        searchHistory.splice(i, 1);
      }
    }
    if(searchHistory.length > maxHistoryLength) {
      searchHistory.splice(0, searchHistory.length - maxHistoryLength);
    }
    chrome.storage.local.set({searchHistory: searchHistory});
    updateHistoryDiv();
  }
}

/**
 * removes list of history items
 */
function clearSearchHistory() {
  searchHistory = [];
  chrome.storage.local.set({searchHistory: searchHistory});
  updateHistoryDiv();
}

/**
 * Flag for case sensitivity
 */
function setCaseInsensitiveElement() {
  var caseInsensitive = chrome.storage.local.get({'caseInsensitive': DEFAULT_CASE_INSENSITIVE},
  function (result) {
    btn_flag.title = result.caseInsensitive ? DISABLE_CASE_INSENSITIVE_TITLE : ENABLE_CASE_INSENSITIVE_TITLE;
    btn_flag.className = result.caseInsensitive ? 'selected' : '';
  });

}
function toggleCaseInsensitive() {
  var caseInsensitive = btn_flag.className == 'selected';
  btn_flag.title = caseInsensitive ? ENABLE_CASE_INSENSITIVE_TITLE : DISABLE_CASE_INSENSITIVE_TITLE;
  btn_flag.className = caseInsensitive ? '' : 'selected';
  sentInput = false;
  chrome.storage.local.set({caseInsensitive: !caseInsensitive});
  passInputToContentScript(true);
}


/*** LISTENERS ***/
btn_next.addEventListener('click', function() {
  selectNext();
});

btn_prev.addEventListener('click', function() {
  selectPrev();
});

document.getElementById('clear').addEventListener('click', function() {
  sentInput = false;
  txt_regex.value = '';
  passInputToContentScript();
  txt_regex.focus();
});

document.getElementById('show-history').addEventListener('click', function() {
  let makeVisible = document.getElementById('history').style.display == 'none';
  document.getElementById('history').style.display = makeVisible ? 'block' : 'none';
  document.getElementById('show-history').className = (makeVisible) ? 'selected' : '';
});

btn_flag.addEventListener('click', function() {
  toggleCaseInsensitive();
});

document.getElementById('copy-to-clipboard').addEventListener('click', function () {
  chrome.tabs.query({
      'active': true,
      'currentWindow': true
    },
    function (tabs) {
      if ('undefined' != typeof tabs[0].id && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          'message': 'copyToClipboard'
        });
      }
    });
});

/* Received returnSearchInfo message, populate popup UI */ 
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('returnSearchInfo' == request.message) {
    processingKey = false;
    if (request.numResults > 0) {
      num_results.textContent = String(request.currentSelection+1) + ' of ' + String(request.numResults);
    } else {
      num_results.textContent = String(request.currentSelection) + ' of ' + String(request.numResults);
    }
    if (!sentInput) {
      txt_regex.value = request.regexString;
    }
    if (request.numResults > 0 && request.cause == 'selectNode') {
      addToHistory(request.regexString);
    }
    if (request.regexString !== txt_regex.value) {
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
    if (txt_regex === document.activeElement) { //input element is in focus
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
    'maxHistoryLength' : MAX_HISTORY_LENGTH,
    'searchHistory' : null
    // 'isSearchHistoryVisible' : false
  },
  function(result) {
    if(result.instantResults) {
      txt_regex.addEventListener('input', function() {
        passInputToContentScript();
      });
    } else {
      txt_regex.addEventListener('change', function() {
        passInputToContentScript();
      });
    }
    if(result.maxHistoryLength) {
      maxHistoryLength = result.maxHistoryLength;
    }
    if(result.searchHistory) {
      searchHistory = result.searchHistory.slice(0);
    } else {
      searchHistory = [];
    }
    document.getElementById('history').style.display = result.isSearchHistoryVisible ? 'block' : 'none';
    document.getElementById('show-history').className = (result.isSearchHistoryVisible) ? 'selected' : '';
    updateHistoryDiv();
});

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
      } else {
        document.getElementById('error').textContent = ERROR_TEXT;
      }
    });
  }
});

/* Focus onto input form */
txt_regex.focus();
window.setTimeout( 
  function(){txt_regex.select();}, 0);
//Thanks to http://stackoverflow.com/questions/480735#comment40578284_14573552

var makeVisible = document.getElementById('history').style.display == 'none';
document.getElementById('history').style.display = makeVisible ? 'block' : 'none';
document.getElementById('show-history').className = (makeVisible) ? 'selected' : '';
chrome.storage.local.set({isSearchHistoryVisible: makeVisible});

setCaseInsensitiveElement();
/*** INIT ***/

