/*** CONSTANTS ***/
var ELEMENT_NODE_TYPE = 1;
var TEXT_NODE_TYPE = 3;
var UNEXPANDABLE = /(script|style|svg|audio|canvas|figure|video|select|input|textarea)/i;
var HIGHLIGHT_TAG = 'highlight-tag';
var HIGHLIGHT_CLASS = 'highlighted';
var SELECTED_CLASS = 'selected';
var DEFAULT_MAX_RESULTS = 500;
var DEFAULT_HIGHLIGHT_COLOR = '#ffff00';
var DEFAULT_SELECTED_COLOR = '#ff9900';
var DEFAULT_TEXT_COLOR = '#000000';
/*** CONSTANTS ***/

/*** VARIABLES ***/
// The current state of the search on this page.
var searchInfo;
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
    regexString : pattern,  //possibly including mode modifiers
    selectedIndex : 0,
    highlightedNodes : [],
    length : 0
  }
}

/* Send message with search information for this tab */
function returnSearchInfo() {
  chrome.runtime.sendMessage({
    'message' : 'returnSearchInfo',
    'regexString' : searchInfo.regexString,   // may include mode modifiers
    'currentSelection' : searchInfo.selectedIndex,
    'numResults' : searchInfo.length
  });
}

/* Check if the given node is a text node */
function isTextNode(node) {
  return node && node.nodeType === TEXT_NODE_TYPE;
}

/* Check if the given node is an expandable node that will yield text nodes */
function isExpandable(node) {
  return node && node.nodeType === ELEMENT_NODE_TYPE && node.childNodes &&
         !UNEXPANDABLE.test(node.tagName) && node.visible();
}

/* Highlight all text that matches regex */
function highlight(regex, highlightColor, selectedColor, textColor, maxResults) {
  function highlightRecursive(node) {
    if(searchInfo.length >= maxResults){
      return;
    }
    if (isTextNode(node)) {
      var index = node.data.search(regex);
      if (index >= 0 && node.data.length > 0) {
        var matchedText = node.data.match(regex)[0];
        var matchedTextNode = node.splitText(index);
        matchedTextNode.splitText(matchedText.length);
        var spanNode = document.createElement(HIGHLIGHT_TAG);
        spanNode.className = HIGHLIGHT_CLASS;
        spanNode.style.backgroundColor = highlightColor;
        spanNode.style.color = textColor;
        spanNode.appendChild(matchedTextNode.cloneNode(true));
        matchedTextNode.parentNode.replaceChild(spanNode, matchedTextNode);
        searchInfo.highlightedNodes.push(spanNode);
        searchInfo.length += 1;
        return 1;
      }
    } else if (isExpandable(node)) {
        var children = node.childNodes;
        for (var i = 0; i < children.length; ++i) {
          var child = children[i];
          i += highlightRecursive(child);
        }
    }
    return 0;
  }
  highlightRecursive(document.getElementsByTagName('body')[0]);
};

/* Remove all highlights from page */
function removeHighlight() {
  while (node = document.body.querySelector(HIGHLIGHT_TAG + '.' + HIGHLIGHT_CLASS)) {
    node.outerHTML = node.innerHTML;
  }
    while (node = document.body.querySelector(HIGHLIGHT_TAG + '.' + SELECTED_CLASS)) {
    node.outerHTML = node.innerHTML;
  }
};

/* Scroll page to given element */
function scrollToElement(element) {
    element.scrollIntoView();
    var top = element.documentOffsetTop() - ( window.innerHeight / 2 );
    window.scrollTo( 0, Math.max(top, window.pageYOffset - (window.innerHeight/2))) ;
}

/* Select first regex match on page */
function selectFirstNode(selectedColor) {
  var length =  searchInfo.length;
  if(length > 0) {
    searchInfo.highlightedNodes[0].className = SELECTED_CLASS;
    searchInfo.highlightedNodes[0].style.backgroundColor = selectedColor;
    scrollToElement(searchInfo.highlightedNodes[0]);
  }
}

/* Helper for selecting a regex matched element */
function selectNode(highlightedColor, selectedColor, getNext) {
  var length = searchInfo.length;
  if(length > 0) {
    searchInfo.highlightedNodes[searchInfo.selectedIndex].className = HIGHLIGHT_CLASS;
    searchInfo.highlightedNodes[searchInfo.selectedIndex].style.backgroundColor = highlightedColor;
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
    searchInfo.highlightedNodes[searchInfo.selectedIndex].className = SELECTED_CLASS;
    searchInfo.highlightedNodes[searchInfo.selectedIndex].style.backgroundColor = selectedColor;
    returnSearchInfo();
    scrollToElement(searchInfo.highlightedNodes[searchInfo.selectedIndex]);
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

/* Validate that a given pattern string is a valid regex.
   Returns the compiled regex if so, or false if not. */
function compileRegexIfValid(pattern, isCaseInsensitive) {
  try{
    var regex = new RegExp(pattern, isCaseInsensitive ? 'i' : '');
    return regex;
  } catch(e) {
    return false;
  }
}

/* Find and highlight regex matches in web page from a given regex string.
   If a string, it may include mode modifiers.
   TODO? also support patterns as args. */
function search(regexString) {
  var regexinfo = splitRegexString(regexString);  //chop mode modifiers
  var regex = compileRegexIfValid(regexinfo.str, "i" in regexinfo);

  if (regex && regexinfo.str != '' && regexString !== searchInfo.regexString) {
    // new valid regex string
    removeHighlight();
    chrome.storage.local.get({
      'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor' : DEFAULT_SELECTED_COLOR,
      'textColor' : DEFAULT_TEXT_COLOR,
      'maxResults' : DEFAULT_MAX_RESULTS},
      function(result) {
        initSearchInfo(regexString);
        highlight(regex, result.highlightColor, result.selectedColor, result.textColor, result.maxResults);
        selectFirstNode(result.selectedColor);
        returnSearchInfo();
      }
    );
  } else if (regex && regexinfo.str != '' &&
              regexString === searchInfo.regexString) {
    // elements are already highlighted
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
    returnSearchInfo();
  }
}
/*** FUNCTIONS ***/

/*** LISTENERS ***/
/* Received search message, find regex matches */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('search' == request.message) {
    search(request.regexString);  // which may include mode modifiers
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
    returnSearchInfo();
  }
});
/*** LISTENERS ***/


/*** INIT ***/
initSearchInfo();
/*** INIT ***/
