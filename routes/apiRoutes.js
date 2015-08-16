var request = require( 'request' );

var express = require('express');
var router = express.Router();

function verifyToken( token )
{
	return function( req, res, next )
	{
		if( req.body.token !== token )
		{
			console.log( "token is " + req.body.token + " and expected is " + token );
			res.status( 401 ).send( "Error: wrong incoming key" )
		}
		else
		{
			next();
		}
	}
}

/* GET users listing. */
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

	var issue =
	{
		"fields": 
		{
			"project":
			{ 
				"key": "SCRAP"
			},
			"summary": summary,
			"issuetype": 
			{
				"name": "Bug"
			}
		}
   }
	
	request(
	{
		method: 'POST',
		uri: "https://" + process.env.JIRA_BASIC_AUTH + "nakedsky.atlassian.net/rest/api/2/issue/",
		json: true,
		body: issue
	}, function( error, data, body )
	{
		res.send( body );
	} );

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

