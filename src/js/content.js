/*** CONSTANTS ***/
var ELEMENT_NODE_TYPE = 1;
var TEXT_NODE_TYPE = 3;
var UNEXPANDABLE = /(script|style|svg|audio|canvas|figure|video|select|input|textarea)/i;
var HIGHLIGHT_TAG = 'highlight-tag';
var HIGHLIGHT_CLASS = 'chrome-regex-search-highlighted';
var SELECTED_CLASS = 'chrome-regex-search-selected';
var DEFAULT_MAX_RESULTS = 500;
var DEFAULT_HIGHLIGHT_COLOR = '#ffff00';
var DEFAULT_SELECTED_COLOR = '#ff9900';
var DEFAULT_TEXT_COLOR = '#000000';
var DEFAULT_CASE_INSENSITIVE = false;
/*** CONSTANTS ***/

/*** VARIABLES ***/
var searchInfo;
var finder;
/*** VARIABLES ***/
                     
/*** LIBRARY FUNCTIONS ***/
Element.prototype.documentOffsetTop = function () {
  return this.offsetTop + ( this.offsetParent ? this.offsetParent.documentOffsetTop() : 0 );
};
Element.prototype.visible = function() {
    return (!window.getComputedStyle(this) || window.getComputedStyle(this).getPropertyValue('display') == '' || 
           window.getComputedStyle(this).getPropertyValue('display') != 'none')
}
/*** LIBRARY FUNCTIONS ***/


/*** FUNCTIONS ***/
/* Initialize search information for this tab */
function initSearchInfo(pattern) {
  var pattern = typeof pattern !== 'undefined' ? pattern : '';
  searchInfo = {
    regexString : pattern,
    selectedIndex : 0,
    highlights : [],
    length : 0
  }
}

/* Send message with search information for this tab */
function returnSearchInfo(cause) {
  chrome.runtime.sendMessage({
    'message' : 'returnSearchInfo',
    'regexString' : searchInfo.regexString,
    'currentSelection' : searchInfo.selectedIndex,
    'numResults' : searchInfo.length,
    'cause' : cause
  });
}

/* Highlight all text that matches regex */
function highlight(regex, highlightColor, selectedColor, textColor, maxResults) {
  finder = findAndReplaceDOMText(
    document.body,
    {
      find: regex,
      wrap: "span",
      wrapClass: HIGHLIGHT_CLASS,
      filterElements: function(element) {
        /* Check if the element is visible */
        /* https://stackoverflow.com/a/21696585 */
        return element.offsetParent !== null || element === document.body;
      },
      preset: "prose"
    }
  )
  searchInfo.highlights = finder.elements;
  searchInfo.length = finder.elements.length;
};

/* Remove all highlights from page */
function removeHighlight() {
  if (finder) {
    finder.revert();
  }
};

/* Scroll page to given element */
function scrollToElement(element) {
    element.scrollIntoView(); 
    var top = element.documentOffsetTop() - ( window.innerHeight / 2 );
    window.scrollTo( 0, Math.max(top, window.pageYOffset - (window.innerHeight/2))) ;
}

/* Select first regex match after selection on page */
function selectFirstNode(selectedColor) {
  if (searchInfo.highlights.length === 0) {
    return;
  }

  function selectIndex(index) {
    searchInfo.selectedIndex = index;
    searchInfo.highlights[index].forEach((e) => { e.className = SELECTED_CLASS; });
    scrollToElement(searchInfo.highlights[index][0]);
  }

  if (getSelection().anchorNode) {
    function path(e) {
      return e.parentNode === null ? [] : path(e.parentNode).concat([Array.prototype.indexOf.call(e.parentNode.childNodes, e)]);
    }

    var selection = path(getSelection().anchorNode)
    var index = searchInfo.highlights.findIndex((h) => path(h[0]) > selection);
    if (index !== -1) {
      selectIndex(index);
      return;
    }
  }

  selectIndex(0);
}

/* Helper for selecting a regex matched element */
function selectNode(highlightedColor, selectedColor, getNext) {
  var length = searchInfo.length;
  if(length > 0) {
    searchInfo.highlights[searchInfo.selectedIndex].forEach(function(n) {
      n.className = HIGHLIGHT_CLASS;
    });
      if(getNext) {
        if(searchInfo.selectedIndex === length - 1) {
          searchInfo.selectedIndex = 0; 
        } else {
          searchInfo.selectedIndex += 1;
        }
      } else {
        if(searchInfo.selectedIndex === 0) {
          searchInfo.selectedIndex = length - 1; 
        } else {
          searchInfo.selectedIndex -= 1;
        }
      }
    searchInfo.highlights[searchInfo.selectedIndex].forEach(function(n) {
      n.className = SELECTED_CLASS;
    });
    returnSearchInfo('selectNode');
    scrollToElement(searchInfo.highlights[searchInfo.selectedIndex][0]);
  }
}
/* Forward cycle through regex matched elements */
function selectNextNode(highlightedColor, selectedColor) {
  selectNode(highlightedColor, selectedColor, true); 
}

/* Backward cycle through regex matched elements */
function selectPrevNode(highlightedColor, selectedColor) {
  selectNode(highlightedColor, selectedColor, false);
}

/* Validate that a given pattern string is a valid regex */
function validateRegex(pattern) {
  try{
    var regex = new RegExp(pattern);
    return regex;
  } catch(e) {
    return false;
  }
}

/* Find and highlight regex matches in web page from a given regex string or pattern */
function search(regexString, configurationChanged) {
  var regex = validateRegex(regexString);
  if (regex && regexString != '' && (configurationChanged || regexString !== searchInfo.regexString)) { // new valid regex string
    removeHighlight();
    chrome.storage.local.get({
      'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor' : DEFAULT_SELECTED_COLOR,
      'textColor' : DEFAULT_TEXT_COLOR,
      'maxResults' : DEFAULT_MAX_RESULTS,
      'caseInsensitive' : DEFAULT_CASE_INSENSITIVE}, 
      function(result) {
        initSearchInfo(regexString);
        if(result.caseInsensitive){
          regex = new RegExp(regexString, 'gi');
        }
        highlight(regex, result.highlightColor, result.selectedColor, result.textColor, result.maxResults);
        selectFirstNode(result.selectedColor);
        returnSearchInfo('search');
      }
    );
  } else if (regex && regexString != '' && regexString === searchInfo.regexString) { // elements are already highlighted
    chrome.storage.local.get({
      'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor' : DEFAULT_SELECTED_COLOR}, 
      function(result) {
        selectNextNode(result.highlightColor, result.selectedColor);
      }
    );
  } else { // blank string or invalid regex
    removeHighlight();
    initSearchInfo(regexString);
    returnSearchInfo('search');
  }
}
/*** FUNCTIONS ***/

/*** LISTENERS ***/
/* Received search message, find regex matches */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('search' == request.message) {
    search(request.regexString, request.configurationChanged);
  }
});

/* Received selectNextNode message, select next regex match */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('selectNextNode' == request.message) {
    chrome.storage.local.get({
      'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor' : DEFAULT_SELECTED_COLOR
      }, 
      function(result) {
        selectNextNode(result.highlightColor, result.selectedColor);
      }
    );
  }
});

/* Received selectPrevNode message, select previous regex match */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('selectPrevNode' == request.message) {
    chrome.storage.local.get({
      'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor' : DEFAULT_SELECTED_COLOR
      }, 
      function(result) {
        selectPrevNode(result.highlightColor, result.selectedColor);
      }
    );
  }
});

/* Received getSearchInfo message, return search information for this tab */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('getSearchInfo' == request.message) {
    sendResponse({message: "I'm alive!"});
    returnSearchInfo('getSearchInfo');
  }
});
/*** LISTENERS ***/


/*** INIT ***/
initSearchInfo();

chrome.storage.local.get({
  'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
  'selectedColor' : DEFAULT_SELECTED_COLOR,
  'textColor' : DEFAULT_TEXT_COLOR,
}, function(result) {
  var css = document.createElement("style");
  css.type = "text/css";
  css.innerHTML =
  "." + HIGHLIGHT_CLASS + " { background: " + result.highlightColor + "; color: " + result.textColor + " }\n" +
  "." + SELECTED_CLASS + " { background: " + result.selectedColor + "; color: " + result.textColor + " }";
  document.body.appendChild(css);
});
/*** INIT ***/
