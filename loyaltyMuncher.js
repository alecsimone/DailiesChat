let streamLabsData = {};
// window.ajaxURL = 'http://localhost/dailieslocal/wp-admin/admin-ajax.php';
window.ajaxURL = 'https://dailies.gg/wp-admin/admin-ajax.php';

let head = $('html');
head.append("<button class='scraperButton'>Scrape</button");
let button = $('.scraperButton');
button.css({position: 'fixed', width: "100px", height: "100px", background: "#e8e8e8", border: "1px solid black", bottom: "20px", right: "100px",});
button.click(function() {
	let table = $('table');
	let rows = table.find('tr');
	$.each(rows, function(index, row) {
		if (index === 0) {return true;}
		let nameElement = $(row).find('.table__name');
		let name = nameElement.children().text().trim();
		let pointsElement = $(row).find('.table__message');
		let points = parseInt(pointsElement.text().trim());
		streamLabsData[name] = points;
	});
	console.table(streamLabsData);
	jQuery.ajax({
		type: "POST",
		url: window.ajaxURL,
		dataType: 'json',
		data: {
			streamLabsData,
			action: 'collect_streamlabs_data',
		},
		error: function(one, two, three) {
			console.log(one);
			console.log(two);
			console.log(three);
		},
		success: function(data) {
			streamLabsData = {};
			console.log(data);
		}
	});
});