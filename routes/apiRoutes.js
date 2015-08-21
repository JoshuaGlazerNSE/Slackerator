"use strict";

var request = require( 'request' );
var express = require('express');
var async = require( 'async' );

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

router.post('/necho', verifyToken( process.env.NECHO_TOKEN ), function(req, res) 
{
	var body = req.body;
	delete body.token;
	res.send( JSON.stringify( body ) );
});

router.post( '/jira', verifyToken( process.env.JIRA_TOKEN ), function( req, res )
{
	var body = req.body;
	var summary = body.text;
	var userName = body.user_name;

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
			"reporter":{"name":userName},
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
			var text = "<https://" + process.env.JIRA_URL + "/browse/" + responseBody.key + " | " + responseBody.key + "    " + summary +">";

			var payload  =
			{
				"channel": channel,
				"username": userName,
				"text": text,
				"icon_emoji": ":bug:"
			};

			request(
			{
				method: 'POST',
				uri: process.env.SLACK_HOOK_URL,
				json: true,
				body: payload
			}, callback );
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

