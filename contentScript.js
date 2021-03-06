window.onload = function() {
	removeRoomsBar();	
	setupGlobalVariables();

	getTwitchUserDB();

	var wholeChatBox = $(".chat-list");
	var leftButtons = $($(".tw-flex.tw-flex-row")[0]);

	addChatBG(wholeChatBox);
	addLockButton(leftButtons);
	addResetButton(leftButtons);
	addTabWatchButton(leftButtons);

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
	// if (window.activeDiscussion) {
	// 	dimByRepAndContribution(fullMsgHTML, messageSender);
	// }


	if (!checkIfChatterHasRep(messageSenderLowerCase)) {
		fullMsgHTML.classList.add('noRep');
	}

	let badges = fullMsgHTML.querySelectorAll('.chat-badge');
	processBadges(badges, messageSender);

	let modIcons = fullMsgHTML.querySelectorAll('.mod-icon');
	processModIcons(modIcons);

	let links = fullMsgHTML.querySelectorAll('.link-fragment');
	if (links.length > 0) {
		processLinks(links, messageSender);
	}

	var wholeMessageContent = fullMsgHTML.querySelectorAll('[data-a-target="chat-message-text"], .chat-line__message--emote, .mention-fragment');
	var wholeMessage = turnWholeMessageIntoWords(wholeMessageContent);

	if (messageSender === 'Nightbot') {
		if (wholeMessage.indexOf("Now discussing") > -1) {
			window.activeDiscussion = true;
		} else if (wholeMessage.indexOf("has moved on to the final round") > -1) {
			window.activeDiscussion = false;
		} else if (wholeMessage.indexOf("has been killed") > -1) {
			window.activeDiscussion = false;
		}
		return;
	}
	recognizeNewChatters(fullMsgHTML, messageSender);

	var emotes = fullMsgHTML.querySelectorAll(".chat-line__message--emote");
	let emoteVote = checkEmotesForVotes(emotes, messageSender);

	var messageTextPieces = fullMsgHTML.querySelectorAll('[data-a-target="chat-message-text"]');;
	let textVote = checkMessageForVotes(messageTextPieces, messageSender);

	if ( (emoteVote === 'yea' && (!textVote || textVote === 'yea') ) || (textVote === 'yea' && (!emoteVote || emoteVote === 'yea') ) ) {
		sendVote(messageSender, 'yea');
	} else if ( (emoteVote === 'nay' && (!textVote || textVote === 'nay') ) || (textVote === 'nay' && (!emoteVote || emoteVote === 'nay') ) ) {
		sendVote(messageSender, 'nay');
	}

	var messageObject = {
		messageSender,
		wholeMessage: wholeMessage.toLowerCase(),
	};
	soundEngine(messageObject);
	checkForPPUpdate(messageObject);
	wordReplacer(messageTextPieces);
	checkForRepGiving(messageObject);
}

function removeRoomsBar() {
	var roomsBar = $(".rooms-header")[0];
	roomsBar.remove();
}

function setupGlobalVariables() {
	window.isFiltering = false;
	window.chattersSoFar = [];
	window.activeDiscussion = false;
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
		message.style.background = "hsla(225, 40%, 60%, .25)";
		window.chattersSoFar.push(messageSender.toLowerCase());
		announce(messageSender.toLowerCase());
		updateMyPP(messageSender);
		notifyOfParticipation(messageSender);
	}
}

function notifyOfParticipation(messageSender) {
	let ajaxData = {
		messageSender,
		action: 'notify_of_participation',
	};
	ajaxReplacement(ajaxData)
		.then(function(data) {
			// if (Number.isInteger(data)) {
			// 	window.TwitchUserDB[messageSender.toLowerCase()].rep = data;
			// 	console.log(`${messageSender} now has ${data} rep`);
			// } else {
			// 	console.log(data);
			// }
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
			} else if (lowercasedWord.includes('!vote') || lowercasedWord.includes('!yea') || lowercasedWord.match('![v|y][0-9]+') !== null) {
				console.log("That's a yea vote!");
				if (checkIfChatterHasRep(messageSender)) {
					var voteNumber = getVoteNumber(lowercasedWord);
					if (!isNaN(voteNumber)) {
						contenderVote(messageSender, voteNumber, "yea");
					}
				}
			} else if (lowercasedWord.includes('!nay') || lowercasedWord.match('!n[0-9]+') !== null) {
				console.log("that's a nay vote!");
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
	return messagePiece.split(/[ ,.]+/);
}
// function getVoteNumber(word) {
// 	let voteLocation = word.indexOf('!vote');
// 	if (voteLocation === -1) {
// 		let nayLocation = word.indexOf('!nay');
// 		if (nayLocation === -1) {
// 			let yeaLocation = word.indexOf('!yea');
// 			var voteString = word.substring(4 + yeaLocation);
// 		} else {
// 			var voteString = word.substring(4 + nayLocation);
// 		}
// 	} else {
// 		var voteString = word.substring(5 + voteLocation);
// 	}
// 	return parseInt(voteString, 10);
// }
function getVoteNumber(word) {
	let matchData = word.match(/[!](?:vote|yea|nay|v|y|n)/);
	let voteNumber = word.substring(matchData[0].length + matchData.index);
	return voteNumber;
}

function turnWholeMessageIntoWords(messageArray) {
	var wholeMessage = '';
	$.each(messageArray, function(index, val) {
		if ($(val).attr("data-a-target") === 'chat-message-text' || $(val).attr("data-a-target") === 'chat-message-mention') {
			wholeMessage = wholeMessage + val.textContent;
		} else if (val.className.indexOf('chat-image') > -1)  {
			wholeMessage = wholeMessage + val.alt;
		}
	});
	return wholeMessage;
}

function sendVote(voter, direction) {
	let ajaxData = {
		voter,
		direction,
		action: 'chat_vote',
	};
	ajaxReplacement(ajaxData)
		.then(function(data) {
			console.log(data);
		});
}

function contenderVote(voter, voteNumber, direction) {
	if (voteNumber === 0 || voteNumber > 25) {
		return;
	}
	console.log(`${voter} voted ${direction} on play number ${voteNumber}`);
	let ajaxData = {
		voter,
		voteNumber,
		direction,
		action: 'chat_contender_vote',
	}
	ajaxReplacement(ajaxData)
		.then(function(data) {
			console.log(data);
			if (direction === "nay") {
				printToChat(data, "error");
			} else {
				printToChat(data);
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
function processBadges(badges, messageSender) {
	let isSub = false;
	jQuery.each(badges, function(index, badge) {
		badge = jQuery(badge);
		if (badge.attr("aria-label").indexOf("Subscriber") > -1) {
			isSub = true;
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
	});
	if (isSub === false && getChatterContribution(messageSender) > 0) {
		let chatBadge = `<img class='dailiesSubBadge chat-badge' src='${dailiesBadge}'>`;
		let badgeContainer = jQuery(badges[0]).parent().parent();
		let wholeMessage = badgeContainer.find('.chat-line__username');
		wholeMessage.before(chatBadge);
	}
}

const timeoutIcon = chrome.runtime.getURL('images/timeout.png');
function processModIcons(modIcons) {
	$.each(modIcons, function(index, element) {
		element = $(element);
		if (element.attr("data-test-selector") === "chat-ban-button") {
			element.css("display", "none");
		} else if (element.attr("data-test-selector") === "chat-timeout-button") {
			element.html(`<img class='timeoutIcon' src=${timeoutIcon}>`);
		} else if (element.attr("data-test-selector") === "chat-delete-button") {
			element.css("display", "none");
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

function dimByRepAndContribution(fullMsgHTML, messageSender) {
	let chatterRep = window.TwitchUserDB[messageSender.toLowerCase()].rep;
	let chatterOpacity = (chatterRep / 20 * .6) + .4;
	if (chatterOpacity > 1) {chatterOpacity = 1;}

	let chatterContribution = getChatterContribution(messageSender);
	if (chatterContribution > 0) {chatterOpacity = 1;}

	fullMsgHTML.style.opacity = chatterOpacity.toString();
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
		let messageTextArray = turnMessagePieceIntoWords(theMessage);
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

function checkForRepGiving(messageObject) {
	let speaker = messageObject.messageSender;
	let message = messageObject.wholeMessage;
	let messageArray = message.split(/[ ,.]+/);
	messageArray.forEach((word, index) => {
		if (word === "!give") {
			let target = messageArray[index + 1];
			if (target === undefined) {
				printToChat(`${speaker}, You didn't pick anyone to give rep to!`, "error");
			}
			if (target[0] === "@") {target = target.substring(1);}
			if (target == speaker.toLowerCase()) {
				console.log("You can't give yourself rep!");
				return;
			}
			let amount = messageArray[index + 2];
			if (isNaN(amount)) {amount = 1;}
			let ajaxData = {
				speaker,
				target,
				amount,
				action: 'give_rep',
			}
			ajaxReplacement(ajaxData)
				.then(function(data) {
					console.log(data);
				});
		}
	})
}

function getTwitchUserDB() {
	let ajaxData = {
		action: "share_twitch_user_db"
	};
	ajaxReplacement(ajaxData)
		.then(function(data) {
			let lowerCasedKeysData = {};
			jQuery.each(data, function(index, val) {
				let lowercaseIndex = index.toLowerCase();
				lowerCasedKeysData[lowercaseIndex] = val;
			});
			window.TwitchUserDB = lowerCasedKeysData;
		});
}
window.setInterval(getTwitchUserDB, 15000);

const defaultPic = chrome.runtime.getURL('images/defaultPic.jpg');
function showProfilePicture(messageSender, fullMsgHTML) {
	fullMsgHTML = jQuery(fullMsgHTML);
	let twitchUserDB = window.TwitchUserDB;
	if (twitchUserDB[messageSender] !== undefined) {
		var senderPic = twitchUserDB[messageSender]['picture'];
		if (twitchUserDB[messageSender]['manualPicture'] !== "none") {
			senderPic = twitchUserDB[messageSender]['manualPicture'];
		}
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
function getChatterContribution(messageSender) {
	if (window.TwitchUserDB[messageSender.toLowerCase()]) {
		return Number(window.TwitchUserDB[messageSender.toLowerCase()].contribution);
	}
	return 0;
}
function getChatterRole(messageSender) {
	if (window.TwitchUserDB[messageSender.toLowerCase()]) {
		return window.TwitchUserDB[messageSender.toLowerCase()].role;
	}
	return "--";
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
			let ajaxData = {
				twitchName: messageSender,
				twitchPic: picSrc,
				twitchID: data.users[0]['_id'],
				action: 'update_twitch_db',
			}
			ajaxReplacement(ajaxData)
				.then(function(data) {
					// console.log(data);
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
	let ajaxData = {
		action: 'reset_chat_votes',
	}
	ajaxReplacement(ajaxData)
		.then(function(data) {
			console.log(data);
		})
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

	let wordsArray = turnMessagePieceIntoWords(msg);
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

	if (getChatterContribution(messageObject.messageSender) < 3) {
		if (getChatterRole(messageObject.messageSender) !== "editor" && getChatterRole(messageObject.messageSender) !== "administrator") {
			console.log("no sound privileges");
			return;
		}
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
		Carb0nRL: 1,
		shadow30128: 0.3,
		refrigeratedtoiletpaper: 0.5,
		orionrl: 1,
		pyre_eu: 0.4,
		satan_is_dirty: 0.2,
		thatguy_from_thatthing: 0.4,
		thecactuskeed: 0.5,
		jwols: 0.6,
		chillpanda5213_rl: 0.6,
		jake_kaufmann: 0.2,
		dackadoo1: 1,
		unduhscore: 0.8,
		crossingmarko: 0.5,
		ollopa: 0.4,
		wavepunk: 0.4,
		wakon1: 0.2,
		novacorpsrl: 0.1,
		gamazzle01: 0.4,
		flamingtreerl: .3,
		orange_burst: 1,
		notdrumzorz: 1,
		sixnineactual: .5,
		manhattaan: .1,
		avx_nyptrox: .2,
		haxzyt: .1,
		ganerrl: .6,
		fisheysauce: .7,
		iamjokarman: .8,
		therewillbebears: .4,
		jkbdoug: 1,
		kutturamaswami: 1,
		guann: 1,
		greentv23: 1,
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
	if (arriver === "Carb0nRL") {
		console.log(customEntrances['entrances'][arriver]);
		console.log("Carbon just showed up");
	}
	if (arriver in customEntrances.entranceFiles) {
		customEntrances['entrances'][arriver].play();
	} else if (mods.includes(arriver)) {
		sounds.sounds.fanfare.play();
	}
}

function printToChat(message, tone="success") {
	let wholeChatBox = $(".chat-list");
	let chatMessagesContainer = $("[role='log']");
	let messageColor = "hsla(106, 68%, 54%, 1)";
	if (tone === "error") {
		messageColor = "hsla(0, 68%, 54%, 1)";
	}
	let wrappedMessage = `<div class="printed_message" style="color: ${messageColor}; font-weight: bold;">${message}</div>`;
	chatMessagesContainer.append(wrappedMessage);
}

function ajaxReplacement(data) {
	return new Promise(function(resolve, reject) {
		chrome.runtime.sendMessage(data, function(response) {
			resolve(response.ajaxResponse);
		});
	});
}