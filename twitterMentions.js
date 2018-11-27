jQuery(window).on('load', function() {
	var filterBar = jQuery('.ProfileHeading-toggle');
	filterBar.append("<li class='ProfileHeading-toggleItem' id='myFilterButton'>Only Good Shit</li>");
	jQuery('#myFilterButton').css("cursor", "pointer");
	jQuery('#myFilterButton').click(function(e) {
		console.log("sup");
		if (jQuery(e.target).hasClass("is-active")) {
			unfilterTweets();
		} else {
			filterTweets();
		}
	});
});

function unfilterTweets() {
	jQuery.each(window.uselessTweets, function(index, tweet) {
		tweet.style.display = "block";
	})
	jQuery('#myFilterButton').removeClass("is-active");
}
function filterTweets() {
	jQuery('#myFilterButton').addClass("is-active");
	var allTweets = jQuery('.tweet');
	window.uselessTweets = [];
	hideUselessTweets(allTweets);

	var toBeObserved = document.querySelector(".stream-items");
	var observationConfig = {
		attributes: false,
		childList: true,
		subtree: true,
	};
	var observer = new MutationObserver(function(mutationsList) {
		jQuery.each(mutationsList, function(index, newItem) {
			if (newItem.addedNodes.length === 0) {
				return;
			}
			var newTweets = [];
			jQuery.each(newItem.addedNodes, function(index, newNode) {
				var tweet = jQuery(newNode).find('.tweet');
				if (tweet[0] === undefined) {
					return;
				}
				hideUselessTweets(tweet);
			});
		});
	});
	observer.observe(toBeObserved, observationConfig);

}
function hideUselessTweets(tweetlist) {
	jQuery.each(tweetlist, function(index, tweet) {
		var hasGoodStuff = checkTweetForGoodStuff(tweet);
		if (!hasGoodStuff) {
			//tweet.style.display = "none";
			tweet.style.opacity = ".2";
			window.uselessTweets.push(tweet);
		}
	});
}
function checkTweetForGoodStuff(tweet) {
	var video = checkTweetForVideo(tweet);
	if (video) {
		return true;
	}
	var link = checkTweetForLink(tweet);
	if (link) {
		return true;
	}
	var quoteTweet = checkTweetForQuoteTweet(tweet);
	if (quoteTweet) {
		return true;
	}
	var mention = checkTweetForMention(tweet);
	if (mention) {
		return true;
	}
}
function checkTweetForVideo(tweet) {
	//var video = jQuery(tweet).find('video');
	//console.log(video[0]);
	var video = jQuery(tweet).find('.AdaptiveMediaOuterContainer');
	if (video[0] !== undefined) {
		return true;
	} else {
		return false;
	}
}
function checkTweetForLink(tweet) {
	var link = jQuery(tweet).find('.card2');
	if (link[0] !== undefined) {
		return true;
	} else {
		return false;
	}
}
function checkTweetForQuoteTweet(tweet) {
	var quoteTweet = jQuery(tweet).find('.QuoteTweet');
	if (quoteTweet[0] !== undefined) {
		return true;
	} else {
		return false;
	}
}
function checkTweetForMention(tweet) {
	var mentions = jQuery(tweet).find('.twitter-atreply');
	var isMention = false;
	jQuery.each(mentions, function(index, mention) {
		var nameElement = jQuery(mention).find('b');
		if (nameElement.text().toLowerCase() === "rocket_dailies") {
			isMention = true;
		}
	});
	if (isMention) {
		return true;
	} else {
		return false;
	}
}