	// var ajaxURL = 'http://localhost/dailieslocal/wp-admin/admin-ajax.php';
	var ajaxURL = 'https://dailies.gg/wp-admin/admin-ajax.php';

var urls;

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		console.log("A message has been recieved!");
		if (request.urlDataMessage !== true) {
			return;
		}
		console.log("got the URL list loaded!");
		urls = request.data;
		chrome.tabs.onActivated.removeListener(tabListener);
		chrome.tabs.onActivated.addListener(tabListener);
	}
);

function tabListener(e) {
		console.log("A new tab has been activated!");
		chrome.tabs.get(e.tabId, function(tabData) {
			var voteNumber = turnURLIntoVoteNumber(tabData.url, urls);
			updateVoteNumber(voteNumber);
		});
}

function updateVoteNumber(voteNumber) {
	console.log("update votenumber fired");
	chrome.tabs.query({url: 'http://dailies.gg/votenumber/'}, function(tabs) {
		if (tabs[0] === undefined) {return;}
		console.log("We've found the votenumber tab!");
		chrome.tabs.sendMessage(tabs[0].id, {voteNumber}, function(response) {
			// console.log(response);
		});
	});
}

function turnURLIntoVoteNumber(activeURL, allContenderURLBits) {
	console.log("Checking the tab to see if it's one of our contenders");
	var urlsArray = Object.keys(allContenderURLBits);
	var voteNumber = false;
	for (var i = urlsArray.length - 1; i >= 0; i--) {
		if ( activeURL.indexOf(allContenderURLBits[i]) > -1 ) {
			voteNumber = i+1;
		}
	}
	console.log(`votenumber is ${voteNumber}`);
	return voteNumber;
}