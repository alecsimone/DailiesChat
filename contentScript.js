	window.ajaxURL = 'http://localhost/dailieslocal/wp-admin/admin-ajax.php';
	// window.ajaxURL = 'https://dailies.gg/wp-admin/admin-ajax.php';
	console.log(window.ajaxURL);

window.onload = function() {
	removeRoomsBar();	
	setupGlobalVariables();

	getTwitchUserDB();

	var wholeChatBox = $(".chat-list");
	var leftButtons = $(".tw-flex.tw-flex-row");

	addChatBG(wholeChatBox);
	addLockButton(leftButtons);
	addResetButton(leftButtons);
	addTabWatchButton(leftButtons);

	wholeChatBox.click(function(e) {
		if (window.isFiltering) {
			stopFilteringChat(wholeChatBox);
		}
		var theMessage = e.target.closest('.chat-line__message');
		if (theMessage === null) {
			return;
		} else if ($(e.target).attr("data-a-target") === 'chat-message-username') {
			e.stopImmediatePropagation();
			let senderToSurvive = e.target.textContent;
			filterChat(wholeChatBox, senderToSurvive);
		} else if ($(e.target).attr("data-a-target") === 'chat-message-mention') {
			let mentionText = e.target.textContent;
			let senderToSurvive = mentionText.substring(1);
			filterChat(wholeChatBox, senderToSurvive);
		}
		//theMessage.style.borderBottom = "1px solid hsla(0, 0%, 100%, .4)";
	});

	wholeChatBox.on('mouseenter', '.chat-author__display-name', function(e) {
		whitenName(e.target);
	});

	wholeChatBox.on('mouseleave', '.chat-author__display-name', function(e) {
		recolorName(e.target);
	});

	//Now we get into the meat of the extension. A mutation observer that watches for any changes to .chat-list
	var toBeObserved = document.querySelector(".chat-list");

	//We don't want attribute changes, those are boring. Just childList changes down the subtree.
	var observationConfig = {
		attributes: false,
		childList: true,
		subtree: true,
	};

	var observer = new MutationObserver(function(mutationsList) {
		//We're going to get little packets of elements that have been changed. Sometimes there will multiple elements in each package, so we need to loop through them.
		$.each(mutationsList, function(index, message) {
			try {	
				if (message.addedNodes[0].className === 'chat-line__message' && message.target.className !== "messageWrapper") {
					processMessage(message);
				}
			} catch (error) {
			}
		});

	});

	observer.observe(toBeObserved, observationConfig);

};

function processMessage(message) {
	//Twitch uses a lot of placeholders, which then get removed, so we need to filter those out.
	if (message['removedNodes'][0] !== undefined) {
		return;
	}

	var fullMsgHTML = message['addedNodes'][0];
	if (fullMsgHTML === undefined) {
		return;
	}
	if (fullMsgHTML.textContent === 'Welcome to the chat room!') {
		return;
	}
	var messageSender = fullMsgHTML.querySelector(".chat-author__display-name").textContent;
	let displayName = fullMsgHTML.querySelector(".chat-author__display-name");
	var messageSenderLowerCase = messageSender.toLowerCase();
	fixNameColor(displayName);
	showProfilePicture(messageSenderLowerCase, fullMsgHTML);
	addRepToName(messageSenderLowerCase, displayName);

	if (!checkIfChatterHasRep(messageSenderLowerCase)) {
		fullMsgHTML.classList.add('noRep');
	}

	let badges = fullMsgHTML.querySelectorAll('.chat-badge');
	processBadges(badges);

	let modIcons = fullMsgHTML.querySelectorAll('.mod-icon');
	processModIcons(modIcons);

	let links = fullMsgHTML.querySelectorAll('.link-fragment');
	if (links.length > 0) {
		processLinks(links, messageSender);
	}

	if (messageSender === 'Nightbot') {
		return;
	}
	recognizeNewChatters(fullMsgHTML, messageSender);

	var emotes = fullMsgHTML.querySelectorAll(".chat-line__message--emote");
	let emoteVote = checkEmotesForVotes(emotes, messageSender);

	var messageTextPieces = fullMsgHTML.querySelectorAll('[data-a-target="chat-message-text"]');
	let textVote = checkMessageForVotes(messageTextPieces, messageSender);

	if ( (emoteVote === 'yea' && (!textVote || textVote === 'yea') ) || (textVote === 'yea' && (!emoteVote || emoteVote === 'yea') ) ) {
		sendVote(messageSender, 'yea');
	} else if ( (emoteVote === 'nay' && (!textVote || textVote === 'nay') ) || (textVote === 'nay' && (!emoteVote || emoteVote === 'nay') ) ) {
		sendVote(messageSender, 'nay');
	}

	var wholeMessageContent = fullMsgHTML.querySelectorAll('[data-a-target="chat-message-text"], .chat-line__message--emote');
	var wholeMessage = turnWholeMessageIntoWords(wholeMessageContent);

	var messageObject = {
		messageSender,
		wholeMessage: wholeMessage.toLowerCase(),
	};
	soundEngine(messageObject);
	checkForPPUpdate(messageObject);
	wordReplacer(messageTextPieces);
}

function removeRoomsBar() {
	var roomsBar = $(".room-selector__header")[0];
	roomsBar.remove();
}

function setupGlobalVariables() {
	window.isFiltering = false;
	window.chattersSoFar = [];
}

function addChatBG(wholeChatBox) {
	var chatBG = chrome.runtime.getURL('images/chatBG.jpg');
	wholeChatBox.css("background", `url(${chatBG}) no-repeat`);
}

function addLockButton(container) {
	var lock = chrome.runtime.getURL('images/lock.png');
	container.append("<img id='chatlock' src='" + lock + "'>");
	$("#chatlock").click(function() {
		var lockbutton = $("#chatlock");
		var scrollableArea = $(".simplebar-scroll-content")[0];
		toggleLockbuttonActivation(lockbutton);
	});
}

function addResetButton(container) {
	var reset = chrome.runtime.getURL('images/reset.png');
	container.append("<img id='resetbutton' src='" + reset + "'>");
	$("#resetbutton").click(function() {
		resetVotes();
	});
}

function addTabWatchButton(container) {
	var tabWatch = chrome.runtime.getURL('images/tabWatch.png');
	container.append(`<img id='tabwatchbutton' src='${tabWatch}'>`);
	$("#tabwatchbutton").click(function() {
		tabwatchInit();
	});
}

function toggleLockbuttonActivation(lockbutton) {
	if (!lockbutton.hasClass("active")) {
		lockbutton.addClass("active");
		var allMessages = $(".chat-line__message");
		var messageCount = allMessages.length;
		var lastMessage = allMessages[messageCount - 1];
		window.lastMessage = lastMessage;
		var lastMessageOffset = lastMessage.offsetTop;
		window.lastMessageOffset = lastMessageOffset
		var scrollableAreaScrollTop = scrollableArea.scrollTop;
		window.areaScrollTop = scrollableAreaScrollTop;
		scrollableArea.addEventListener("scroll", lockscroll);
	} else {
		lockbutton.removeClass("active");
		scrollableArea.removeEventListener("scroll", lockscroll);
	}
}
function lockscroll() {
	var scrollableArea = $(".simplebar-scroll-content");
	var lastMessage = window.lastMessage;
	var lastMessageOffset = lastMessage.offsetTop;
	var messageOffsetDifference = lastMessageOffset - window.lastMessageOffset;
	var areaScrollTarget = window.areaScrollTop + messageOffsetDifference;
	scrollableArea.scrollTop(areaScrollTarget);
}

function filterChat(chatWindow, senderToSurvive) {
	var allMessages = chatWindow.find('.chat-line__message');
	$.each(allMessages, function(index, message) {
		 var thisSender = message.querySelector(".chat-author__display-name").textContent;
		 if (thisSender !== senderToSurvive) {
		 	message.style.opacity = "0.2";
		 };
	});
	window.isFiltering = true;
}
function stopFilteringChat(chatWindow) {
	var allMessages = chatWindow.find('.chat-line__message');
	$.each(allMessages, function(index, message) {
		message.style.opacity = "1";
	});
	window.isFiltering = false;
}

function whitenName(nameToWhiten) {
	var originalColor = getOriginalColor(nameToWhiten);
	$(nameToWhiten).attr("originalcolor", originalColor);
	nameToWhiten.style.color = "white";
}
function getOriginalColor(el) {
	var originalStyle = $(el).attr("style");
	var colorIndex = originalStyle.indexOf('color: ');
	var colorCodeIndex = colorIndex + 7;
	var semicolonIndex = originalStyle.indexOf(';');
	var originalColor = originalStyle.substring(colorCodeIndex, semicolonIndex);
	return originalColor;
}
function recolorName(nameToRecolor) {
	var originalColor = $(nameToRecolor).attr("originalcolor");
	nameToRecolor.style.color = originalColor;
}

function recognizeNewChatters(message, messageSender) {
	if (!window.chattersSoFar.includes(messageSender.toLowerCase())) {
		message.style.background = "hsla(225, 40%, 50%, .2)";
		window.chattersSoFar.push(messageSender.toLowerCase());
		announce(messageSender.toLowerCase());
		updateMyPP(messageSender);
		notifyOfParticipation(messageSender);
	}
}

function notifyOfParticipation(messageSender) {
	jQuery.ajax({
		type: "POST",
		url: window.ajaxURL,
		dataType: 'json',
		data: {
			messageSender,
			action: 'notify_of_participation',
		},
		error: function(one, two, three) {
			console.log(one);
			console.log(two);
			console.log(three);
		},
		success: function(data) {
			if (Number.isInteger(data)) {
				window.TwitchUserDB[messageSender.toLowerCase()].rep = data;
				console.log(`${messageSender} now has ${data} rep`);
			} else {
				console.log(data);
			}
		}
	});
}

function checkEmotesForVotes(emotes, messageSender) {
	let yeaVote = false;
	let nayVote = false;
	$.each(emotes, function(index, thisEmoteElement) {
		var thisEmoteName = thisEmoteElement.alt;
		if (thisEmoteName === 'VoteYea') {
			yeaVote = true;
		} else if (thisEmoteName === 'VoteNay') {
			nayVote = true;
		}
	});
	if (yeaVote && nayVote) {
		console.log("you equivocating like a mothafucka");
		return false;
	} else if (yeaVote) {
		return 'yea';
	} else if (nayVote) {
		return 'nay';
	}
	return false;
}

function checkMessageForVotes(messageTextPieces, messageSender) {
	let voteYea = false;
	let voteNay = false;
	$.each(messageTextPieces, function(index, val) {
		var wordsArray = turnMessagePieceIntoWords(val.textContent);
		$.each(wordsArray, function(index, word) {
			var lowercasedWord = word.toLowerCase();
			if (lowercasedWord === 'voteyea' || lowercasedWord === 'vy') {
				voteYea = true;
			} else if (lowercasedWord === 'votenay' || lowercasedWord === 'neigh' || lowercasedWord === 'vn') {
				voteNay = true;
			} else if (lowercasedWord.includes('!vote')) {
				if (checkIfChatterHasRep(messageSender)) {
					var voteNumber = getVoteNumber(lowercasedWord);
					if (!isNaN(voteNumber)) {
						contenderVote(messageSender, voteNumber, "yea");
					}
				}
			} else if (lowercasedWord.includes('!nay')) {
				if (checkIfChatterHasRep(messageSender)) {
					var voteNumber = getVoteNumber(lowercasedWord);
					if (!isNaN(voteNumber)) {
						contenderVote(messageSender, voteNumber, "nay");
					}
				}
			}
		});
	});
	if (voteYea && voteNay) {
		console.log("you equivocatin like a mothafucka");
		return false;
	} else if (voteYea) {
		return 'yea';
	} else if (voteNay) {
		return 'nay';
	}
	return false;
}
function turnMessagePieceIntoWords(messagePiece) {
	return messagePiece.split(' ');
}
function getVoteNumber(word) {
	let voteLocation = word.indexOf('!vote');
	if (voteLocation === -1) {
		let nayLocation = word.indexOf('!nay');
		var voteString = word.substring(4 + nayLocation);
	} else {
		var voteString = word.substring(5 + voteLocation);
	}
	return parseInt(voteString, 10);
}

function turnWholeMessageIntoWords(messageArray) {
	var wholeMessage = '';
	$.each(messageArray, function(index, val) {
		if ($(val).attr("data-a-target") === 'chat-message-text') {
			wholeMessage = wholeMessage + val.textContent;
		} else if (val.className.indexOf('chat-image') > -1)  {
			wholeMessage = wholeMessage + val.alt;
		}
	});
	return wholeMessage;
}

function sendVote(voter, direction) {
	jQuery.ajax({
		type: "POST",
		url: window.ajaxURL,
		dataType: 'json',
		data: {
			voter,
			direction,
			action: 'chat_vote',
		},
		error: function(one, two, three) {
			console.log(one);
			console.log(two);
			console.log(three);
		},
		success: function(data) {
			console.log(data);
		}
	});
}

function contenderVote(voter, voteNumber, direction) {
	if (voteNumber === 0 || voteNumber > 25) {
		return;
	}
	console.log(`${voter} voted ${direction} on play number ${voteNumber}`);
	jQuery.ajax({
		type: "POST",
		url: window.ajaxURL,
		dataType: 'json',
		data: {
			voter,
			voteNumber,
			direction,
			action: 'chat_contender_vote',
		},
		error: function(one, two, three) {
			console.log(one);
			console.log(two);
			console.log(three);
		},
		success: function(data) {
			console.log(data);
		}
	});
}

function processLinks(links, messageSender) {
	if (!checkIfChatterHasRep(messageSender)) {
		links.forEach( (link) => {
			link.innerHTML = "";
			link.innerText = "<link hidden because you have 0 rep>";
			link.style = "text-decoration: none; color: hsla(0, 0%, 90%, .5) !important;";
		});
	}
}

const dailiesBadge = chrome.runtime.getURL('images/subBadge.png');
const modBadge = chrome.runtime.getURL('images/sword.jpg');
function processBadges(badges) {
	jQuery.each(badges, function(index, badge) {
		badge = jQuery(badge);
		if (badge.attr("aria-label").indexOf("Subscriber") > -1) {
			let badgeContainer = badge.parent();
			badge.css("display", "none");
			badgeContainer.append(`<img class='dailiesSubBadge chat-badge' src='${dailiesBadge}'>`);
		} else if (badge.attr("aria-label") === "Moderator badge") {
			let badgeContainer = badge.parent();
			badge.css("display", "none");
			badgeContainer.prepend(`<img class='dailiesModBadge chat-badge' src='${modBadge}'>`);
		} else if (badge.attr("aria-label").indexOf("cheer") > -1 || badge.attr("aria-label") === "Sub Gifter badge" || badge.attr("aria-label") === "Verified badge") {
		} else {
			badge.css("display", "none");
		}
	})
}

const timeoutIcon = chrome.runtime.getURL('images/timeout.png');
function processModIcons(modIcons) {
	$.each(modIcons, function(index, element) {
		element = $(element);
		if (element.attr("data-test-selector") === "chat-ban-button") {
			element.css("display", "none");
		} else if (element.attr("data-test-selector") === "chat-timeout-button") {
			element.html(`<img class='timeoutIcon' src=${timeoutIcon}>`);
		}
	})
}

function fixNameColor(displayName) {
	let color = displayName.style.color;
	if (color === 'rgb(0, 0, 0)' || color === 'rgb(0, 0, 255)' || color === 'rgb(23, 11, 193);' || color === 'rgb(38, 3, 71)' || color === 'rgb(46, 60, 86)' || color === 'rgb(25, 46, 179)' || color=== 'rgb(39, 19, 185)' || color === 'rgb(0, 24, 204)' || color === 'rgb(58, 6, 132)') {
		displayName.style.color = 'rgb(30, 144, 255)';
	}
	if (!checkIfChatterHasRep(displayName.textContent)) {
		displayName.style.color = 'hsla(0, 0%, 80%, .5)';
	}
}

var voteYeaEmote = chrome.runtime.getURL('images/voteyea.png');
var voteNayEmote = chrome.runtime.getURL('images/votenay.png');
var wordReplacements = {
	vy: `<img src=${voteYeaEmote} style="width: 28px; height: 28px; vertical-align: middle;" />`,
	vn: `<img src=${voteNayEmote} style="width: 28px; height: 28px; vertical-align: middle;" />`,
};
function wordReplacer(messageTextPieces) {
	messageTextPieces.forEach( (messageTextPiece) => {
		var theMessage = messageTextPiece.innerText;
		let messageTextArray = theMessage.split(' ');
		messageTextArray.forEach( (word) => {
			lowercasedWord = word.toLowerCase();
			if ( wordReplacements.hasOwnProperty(lowercasedWord) ) {
				wordLocation = theMessage.indexOf(word);
				wordLength = word.length;
				let messageBeginning = theMessage.substring(0, wordLocation);
				let messageEnd = theMessage.substring(wordLocation + wordLength);
				let newMessage = messageBeginning + wordReplacements[lowercasedWord]  + messageEnd;
				messageTextPiece.innerHTML = newMessage;
			}
		});
	});
}

function getTwitchUserDB() {
	jQuery.ajax({
		type: "POST",
		url: window.ajaxURL,
		dataType: 'json',
		data: {
			action: 'share_twitch_user_db',
		},
		error: function(one, two, three) {
			console.log(one);
			console.log(two);
			console.log(three);
		},
		success: function(data) {
			let lowerCasedKeysData = {};
			jQuery.each(data, function(index, val) {
				let lowercaseIndex = index.toLowerCase();
				lowerCasedKeysData[lowercaseIndex] = val;
			});
			window.TwitchUserDB = lowerCasedKeysData;
		}
	});
}
window.setInterval(getTwitchUserDB, 30000);

const defaultPic = chrome.runtime.getURL('images/defaultPic.jpg');
function showProfilePicture(messageSender, fullMsgHTML) {
	fullMsgHTML = jQuery(fullMsgHTML);
	let twitchUserDB = window.TwitchUserDB;
	if (twitchUserDB[messageSender] !== undefined) {
		var senderPic = twitchUserDB[messageSender]['picture'];
	} else {
		var senderPic = defaultPic;
	}
	if (senderPic === 'none') {
		senderPic = defaultPic;
	}	
	//fullMsgHTML.wrap("<div class='messageWrapper'></div>");
	fullMsgHTML.prepend(`<img src="${senderPic}" class="chatter-avatar ${messageSender}-avatar">`);
}

function addRepToName(messageSender, displayName) {
	let rep = 0;
	if (window.TwitchUserDB[messageSender]) {
		rep = window.TwitchUserDB[messageSender].rep;
	}
	if (messageSender === 'nightbot') {
		rep = '♾️';
	}
	displayName.innerText = `[${rep}] ${displayName.innerText}`;
}

function checkIfChatterHasRep(messageSender) {
	if (window.TwitchUserDB[messageSender.toLowerCase()]) {
		if (window.TwitchUserDB[messageSender.toLowerCase()].rep > 0) {
			return true;
		}
	}
	return false;
}

function checkForPPUpdate(messageObject) {
	if (messageObject.wholeMessage === '!updatemypp' && messageObject.messageSender !== 'nightbot') {
		updateMyPP(messageObject.messageSender);
	}
}

function updateMyPP(messageSender) {
	const hasRep = checkIfChatterHasRep(messageSender);
	if (!hasRep) {return;}
	var query = 'https://api.twitch.tv/kraken/users?login=' + messageSender;
	jQuery.ajax({
		type: 'GET',
		url: query,
		headers: {
			'Client-ID' : privateData.twitchClientID,
			'Accept' : 'application/vnd.twitchtv.v5+json',
		},
		error: function(one, two, three) {
			console.log(one);
			console.log(two);
			console.log(three);
		},
		success: function(data) {
			var picSrc = data.users[0]['logo'];
			if (window.TwitchUserDB[messageSender] === undefined) {
				window.TwitchUserDB[messageSender] = {
					picture: picSrc,
					rep: 1,
				};
			} else {
				window.TwitchUserDB[messageSender].picture = picSrc;
			}
			var allPriorPPs = jQuery(`.${messageSender}-avatar`);
			jQuery.each(allPriorPPs, function(index, pp) {
				pp.src = picSrc;
			});
			jQuery.ajax({
				type: "POST",
				url: window.ajaxURL,
				dataType: 'json',
				data: {
					twitchName: messageSender,
					twitchPic: picSrc,
					action: 'update_twitch_db',
				},
				error: function(one, two, three) {
					console.log(one);
					console.log(two);
					console.log(three);
				},
				success: function(data) {
					// console.log(data);
				}
			});
		}
	});
}

function resetVotes() {
	window.votecount = 0;
	window.yeaVoters = [];
	window.nayVoters = [];
	var votecount = $('#votecount');
	votecount.html(window.votecount);
	jQuery.ajax({
		type: "POST",
		url: window.ajaxURL,
		dataType: 'json',
		data: {
			action: 'reset_chat_votes',
		},
		error: function(one, two, three) {
			console.log(one);
			console.log(two);
			console.log(three);
		},
		success: function(data) {
			console.log(data);
		}
	});
}

function tabwatchInit() {
	if (window.confirm("Do you want to reset the voteledgers?")) {
		console.log("Tab watch button pressed");
		jQuery.ajax({
			type: "POST",
			url: window.ajaxURL,
			dataType: 'json',
			data: {
				action: 'get_contender_urls',
			},
			error: function(one, two, three) {
				console.log(one);
				console.log(two);
				console.log(three);
			},
			success: function(data) {
				console.log("Contender URLs returned from server");
				console.log(data);
				var messageObject = {
					urlDataMessage: true,
					data
				}
				chrome.runtime.sendMessage(messageObject);
			}
		});
	}
}

function soundEngine(messageObject) {
	var sender = messageObject.messageSender.toLowerCase();
	var msg = messageObject.wholeMessage;

	if (sender === 'nightbot') {
		return;
	}
	if (!checkIfChatterHasRep(messageObject.messageSender)) {
		return;
	}

	let wordsArray = msg.split(' ');
	wordsArray.forEach((word) => {
		if (word === 'vy') {
			sounds.sounds.ding.play();
		} else if (word === 'vn') {
			sounds.sounds.snip2.play();
		}
	});

	if (msg.indexOf('voteyea') > -1 && msg.indexOf('votenay') > -1) {
		console.log("you equivocating like a mothafucka");
	} else if (msg.indexOf('voteyea') > -1) {
		sounds.sounds.ding.play();
	} else if (msg.indexOf('votenay') > -1 || msg.indexOf('cut it') > -1 || (msg.indexOf('!cut') > -1 && msg.indexOf('!cute') === -1)) {
		sounds.sounds.snip2.play();
	} else if (msg.indexOf('neigh') > -1) {
		sounds.sounds.neigh.play();
	}

	if (msg.indexOf('!justa') > -1) {
		sounds.sounds.yawn.play();
	} else if (msg.indexOf('burn it') > -1) {
		sounds.sounds.burn.play();
	} else if (msg.indexOf('kill it') > -1) {
		sounds.sounds.machinegun.play();
	} else if (msg.indexOf('!mozz') > -1) {
		sounds.sounds.chainsaw.play();
	} else if (msg.indexOf('!get') > -1) {
		sounds.sounds.get.play();
	}

	if (msg.indexOf('lul') > -1 || msg.indexOf('lol') > -1 ) {
		var lulArray = ['lul', 'lul2', 'lul3', 'lul4', 'lul5', 'lul6'];
		var lulCount = lulArray.length;
		var lulIndex = rand(0, lulCount);
		var lulToPlay = lulArray[lulIndex];
		sounds['sounds'][lulToPlay].play();
	} else if (msg.indexOf('lmao') > -1 || msg.indexOf('lmfao') > -1) {
		var lmaoArray = ['lmao', 'lmao2', 'lmao3', 'lmao4', 'lmao5', 'lmao6'];
		var lmaoCount = lmaoArray.length;
		var lmaoIndex = rand(0, lmaoCount);
		var lmaoToPlay = lmaoArray[lmaoIndex];
		sounds['sounds'][lmaoToPlay].play();
	}

	if (msg.indexOf('!alecdidsomethingdumbcounter') > -1) {
		sounds.sounds.wompWomp.play();
	}

	if (msg.indexOf('wallle') > -1) {
		sounds.sounds.wallle.play();
	}
}

var sounds = {
	soundFiles: {
		ding: 0.3, 
		snip2: 0.5,
		burn: .4,
		machinegun: 0.25,
		chainsaw: 0.2,
		yawn: 0.2,
		lul: 0.2,
		lul2: 0.2,
		lul3: 0.2,
		lul4: 0.2,
		lul5: 0.2,
		lul6: 0.2,
		lmao: 0.08,
		lmao2: 0.2,
		lmao3: 0.2,
		lmao4: 0.4,
		lmao5: 0.6,
		lmao6: 0.6,
		wompWomp: 0.8,
		neigh: 0.25,
		fanfare: 0.2,
		wallle: 0.5,
		get: .3,
	},
	sounds: [],
}
function setupSounds() {
	jQuery.each(sounds.soundFiles, function(sound, volume) {
		var thisSoundFile = chrome.runtime.getURL(`sounds/${sound}.mp3`);
		sounds['sounds'][sound] = new Audio(thisSoundFile);
		sounds['sounds'][sound]['volume'] = volume;
	});
}
setupSounds();

function rand(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

var customEntrances = {
	entranceFiles: {
		chimblade: .8,
		strangest_stranger: 0.3,
		seamuscahill: 0.1, 
		fluctuantflatulence: 0.2,
		carbonttv: 0.6,
		shadow30128: 0.3,
		refrigeratedtoiletpaper: 0.5,
		orionrl: 0.7,
		pyre_eu: 0.4,
		satan_is_dirty: 0.4,
		thatguy_from_thatthing: 0.4,
		thecactuskeed: 0.6,
		jwols: 0.6,
		chillpanda5213_rl: 0.6,
		jake_kaufmann: 0.2,
		dackadoo1: 1,
		unduhscore: 0.8,
		crossingmarko: 0.5,
		ollopa: 0.4,
		wavepunk: 0.4,
		wakon1: 0.4,
		novacorpsrl: 0.1,
		gamazzle: 0.2,
		flamingtreerl: .3,
		orange_burst: 1,
		notdrumzorz: 1,
		sixnineactual: .5,
		eroticnugget: .1,
		nyptrox: .4,
		haxzyt: .1,
	},
	entrances: [],
};
function setupEntrances() {
	jQuery.each(customEntrances.entranceFiles, function(user, volume) {
		customEntrances['entrances'][user] = new Audio(chrome.runtime.getURL(`sounds/entrances/${user}.mp3`));
		customEntrances['entrances'][user]['volume'] = volume;	
	});
}
setupEntrances();

function announce(arriver) {
	var mods = [
		'chimblade', 'dailiesalec', 'derrothh', 'dudewiththenose', 'mrtoastymuffinz', 'mysterylsg', 'orionrl', 'refrigeratedtoiletpaper', 'sid_o7', 'skyrider50', 'strangest_stranger', 'theturbolemming', 'wakon1'
	];

	if (arriver in customEntrances.entranceFiles) {
		customEntrances['entrances'][arriver].play();
	} else if (mods.includes(arriver)) {
		sounds.sounds.fanfare.play();
	}
}