window.onload = function() {
	var page = jQuery('#page-container');
	page.on('click', '.tweet', addLoopToContainedVideo);

	var overlayModal = jQuery("#permalink-overlay-dialog");
	overlayModal.on('click', '.tweet', addLoopToContainedVideo);
}

function addLoopToContainedVideo() {
	console.log(this);
	video = jQuery(this).find('video')[0];
	if (video) {
		video.loop = true;
	}
}