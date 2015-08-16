var express = require('express');
var router = express.Router();

function verifyToken( req, res, next )
{
	token = req.body.token;
	if( token !== process.env.INCOMING_KEY )
	{
		console.log( "token is " + token + " and expected is " + process.env.INCOMING_KEY );
		res.status( 403 ).send( "Error: wrong incoming key" )
	}
	else
	{
		next();
	}
}

/* GET users listing. */
router.post('/necho', verifyToken, function(req, res, next) 
{
	var body = req.body;

	delete body.token;
	res.send( JSON.stringify( body ) );
});

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