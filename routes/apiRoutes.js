"use strict";

var request = require( 'request' );
var express = require('express');
var async = require( 'async' );
require('ssl-root-cas/latest').inject();

var router = express.Router();

function verifyToken( token )
{
	return function( req, res, next )
	{
		if( req.body.token !== token )
		{
			console.log( "token is " + req.body.token + " and expected is " + token );
			res.status( 401 ).send( "Error: wrong incoming key" );
		}
		else
		{
			next();
		}
	};
}

function tellSlack( text, channel, userName, icon, callback )
{
	var payload  =
	{
		"channel": channel,
		"username": userName,
		"text": text,
		"icon_emoji": icon
	};

	request(
	{
		method: 'POST',
		uri: process.env.SLACK_HOOK_URL,
		json: true,
		body: payload
	}, callback );
}

router.post('/necho', verifyToken( process.env.NECHO_TOKEN ), function(req, res) 
{
	var body = req.body;
	delete body.token;
	res.send( JSON.stringify( body ) );
});

router.post( '/fortbuilder', verifyToken( process.env.FORTBUILDER_TOKEN ), function( req, res )
{
	var body = req.body;
	var deployTarget = body.text;
	var userName = body.user_name;

	//var channel = "#scrapforceeng";
	var channel = "@josh";


	var allowedNames = { josh:1, charles:1, jtani:1, justin:1 };
	
	async.waterfall(
	[

		function( callback )
		{
			if( allowedNames[ userName ] )
			{
				//fortbuilder, do your thing!
				var token = process.env.JENKINS_BUILD_TOKEN;
				var url = process.env.JENKINS_URL;
				url = url + "?token=" + token + "&DESIRED_REV=HEAD&DEPLOY_TARGET=" + deployTarget + "&cause=Slack%20Command:%20" + deployTarget;

				request(
				{
					method: 'GET',
					uri: url,
				}, callback );
			}
			else
			{
				callback( null, "", "Not authorized to access fortbuilder" );
			}
		},

		function( data, responseBody, callback )
		{
			console.log( "responseBody from fortbuilder request: " + responseBody );
			tellSlack( responseBody, channel, userName, ":hammer:", callback );
		}
	],
	function( error )
	{
		if( error )
		{
			console.log( "Error: " + error );
			res.status( 500 ).send( error );
		}
		else
		{
			res.status( 200 ).end();
		}
	});

} );

router.post( '/jira', verifyToken( process.env.JIRA_TOKEN ), function( req, res )
{
	var body = req.body;
	var summary = body.text;
	var userName = body.user_name;

	//if the username isn't a recognized name, prefix with a colon and make josh report it...
	var reporterName = userName;
	var allowedNames = { josh:1, charles:1, jtani:1, justin:1, malika:1 };
	if( !allowedNames[ reporterName ] )
	{
		reporterName = "josh";
		summary = userName + ": " + summary;
	}

	var channel = "#scrapforce";
	var projectKey = "SCRAP";

	var issue =
	{
		"fields": 
		{
			"project":
			{ 
				"key": projectKey
			},
			"summary": summary,
			"reporter":{"name":reporterName},
			"issuetype": 
			{
				"name": "Bug"
			}
		}
   };

	async.waterfall(
	[
		function( callback )
		{
			request(
			{
				method: 'POST',
				uri: "https://" + process.env.JIRA_BASIC_AUTH + "@" + process.env.JIRA_URL + "/rest/api/2/issue/",
				auth:
				{
					user:process.env.JIRA_USER,
					pass:process.env.JIRA_PASS,
					sendImmediately:true
				},
				json: true,
				body: issue
			}, callback );
		},

		function( data, responseBody, callback )
		{
			//get they key to make a clickable link
			var text = "<https://" + process.env.JIRA_URL + "/browse/" + responseBody.key + " | " + responseBody.key + ">    " + summary;
			tellSlack( text, channel, userName, ":bug:", callback );
		}
	]
	,function( error )
	{
		if( error )
		{
			console.log( "Error: " + error );
			res.status( 500 ).send( error );
		}
		else
		{
			res.status( 200 ).end();
		}
	});
	
	
	

} );

module.exports = router;

/*
token=gIkuvaNzQIHg97ATvDxqgjtO
team_id=T0001
team_domain=example
channel_id=C2147483705
channel_name=test
user_id=U2147483697
user_name=Steve
command=/weather
text=94070




*/

