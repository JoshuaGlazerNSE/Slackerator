"use strict";

var request = require( 'request' );
var express = require('express');
var async = require( 'async' );
var path = require( 'path' );

require('ssl-root-cas/latest')
	.inject()
	.addFile( path.join( __dirname, '..', 'certs', 'ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'ca-sha2.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class1.client.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class1.client.sha2.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class1.dcsc.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class1.dcsc.sha2.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class1.mobileexperts.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class1.osmio.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class1.osmio.sha2.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class1.server.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class1.server.sha2.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class2.client.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class2.code.sha2.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class2.janrain.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class2.server.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class2.server.sha2.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class3.server.ca.crt' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class1.server.ca.pem' ) )
	.addFile( path.join( __dirname, '..', 'certs', 'sub.class3.code.ca.crt' ) );

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
	const body = req.body;
	//split this by spaces, we might want muvio
	const params = body.text.split( " " );

	const deployTarget = params[ 0 ].trim();

	const projectName = params.length > 1 : params[ 1 ].trim() : "ScrapForceCurrent";

	var userName = body.user_name;

	var channel = "#scrapforceeng";

	var allowedNames = { josh:1, charles:1, jtani:1, justin:1, john: 1 };
	
	async.waterfall(
	[

		function( callback )
		{
			if( allowedNames[ userName ] )
			{
				//fortbuilder, do your thing!
				var token = process.env.JENKINS_BUILD_TOKEN;
				var url = process.env.JENKINS_URL;

				url = url.replace( "{0}", projectName );

				var cause = "Slack command: " + deployTarget + " for project" + projectName + " from user " + userName;
				url = url + "?token=" + token + "&DESIRED_REV=HEAD&DEPLOY_TARGET=" + deployTarget + "&cause=" + encodeURIComponent( cause );

				console.log( "url: " + url );

				request(
				{
					method: 'GET',
					uri: url,
					auth:
					{
						user:process.env.JENKINS_USER,
						pass:process.env.JENKINS_API_TOKEN,
						sendImmediately:true
					},
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
			if( !responseBody )
			{
				responseBody = deployTarget + " " + projectName + " Build started successfully.  Wouldn't it be nice if you got a message when it finished?";
			}
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

