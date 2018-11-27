window.onload = function() {
	setTimeout(function() {
		var player = jQuery('.player-video video');
		player[0].loop = true;
		var videoSrc = player[0].src;
		var socialBoxes = getSocialBoxes();
		addDownloadLink(socialBoxes, videoSrc);
	}, 1000);
}

function getSocialBoxes() {
	var socialBoxContainer = jQuery('.tw-align-items-center.tw-flex.tw-justify-content-end.tw-mg-y-1.tw-relative.tw-z-above');
	return jQuery(socialBoxContainer[0]);
}

function addDownloadLink(socialBoxes, videoSrc) {
	var boxToAdd = `<div class="social-button"><a id="videoDownloadLink" href="${videoSrc}"><img src="https://dailies.gg/wp-content/uploads/2018/01/Red-Down-Arrow.png"></a></div>`;
	socialBoxes.prepend(boxToAdd);
}