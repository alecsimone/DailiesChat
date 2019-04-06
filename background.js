	// var ajaxURL = 'http://localhost/dailieslocal/wp-admin/admin-ajax.php';
	var ajaxURL = 'https://dailies.gg/wp-admin/admin-ajax.php';

var urls;

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		console.log(request);
		jQuery.ajax({
			type: "POST",
			url: ajaxURL,
			dataType: 'json',
			data: request,
			error: function(one, two, three) {
				sendResponse({ajaxResponse: "it fucked up"});
			},
			success: function(data) {
				sendResponse({ajaxResponse: data});
			}
		});
		// sendResponse({ajaxResponse: "fuck shutson"});
		return true;
	}
);