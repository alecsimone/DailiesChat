chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.voteNumber) {
		console.log(`votenumber was ${request.voteNumber}`);
		jQuery("#votenumber").text(`!vote${request.voteNumber}`);
	} else {
		console.log("Votenumber was false");
		jQuery("#votenumber").text('');
	}
	sendResponse({farewell: "goodbye"});
});