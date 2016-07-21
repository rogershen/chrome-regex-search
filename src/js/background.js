/* Received returnSearchInfo message, set badge text with number of results */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('returnSearchInfo' == request.message) {
    chrome.browserAction.setBadgeText({
      'text': String(request.numResults),
      'tabId': sender.tab.id
    });
  }
});
