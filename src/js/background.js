var DEFAULT_CONTEXT_MENU = true;
var oldcontextMenuState = DEFAULT_CONTEXT_MENU;
var newContextMenuState = DEFAULT_CONTEXT_MENU;
var escapedSearches = {};

/* Received returnSearchInfo message, set badge text with number of results */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('returnSearchInfo' == request.message) {
    chrome.browserAction.setBadgeText({
      'text': String(request.numResults),
      'tabId': sender.tab.id
    });
    newContextMenuState = !!request.regexString;
    if (!newContextMenuState) {
      delete escapedSearches[sender.tab.id];
    }
  } else if ('triggerContextMenu' === request.message) {
    chrome.contextMenus.update('regex-search', {
      visible: (newContextMenuState = request.visible)
    });
  }
  if (newContextMenuState != oldcontextMenuState) {
    chrome.contextMenus.update('regex-search-again', {
      visible: (oldcontextMenuState = newContextMenuState)
    });
  }
});

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get({
    'contextMenu': DEFAULT_CONTEXT_MENU
  }, function(result) {
    chrome.contextMenus.update('regex-search', {
      visible: result.contextMenu
    });
  });
  chrome.contextMenus.create({
    id: 'regex-search',
    title: 'search /%s/ on this page',
    contexts: ['selection'],
    visible: false,
    onclick: function(info, tab) {
      chrome.tabs.sendMessage(tab.id, {
        'message': 'search',
        'regexString': (escapedSearches[tab.id] = info.selectionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      });
      chrome.contextMenus.update('regex-search-again', {
        title: 'search next',
        visible: true
      });
    }
  });
  chrome.contextMenus.create({
    id: 'regex-search-again',
    title: 'search again',
    contexts: ['page'],
    visible: false,
    onclick: function(info, tab) {
      chrome.tabs.sendMessage(tab.id, {
        'message' : 'search',
        'regexString' : escapedSearches[tab.id],
        'getNext': true
      });
    }
  });
});
