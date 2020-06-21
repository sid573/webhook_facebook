'use strict';
// const PAGE_ACCESS_TOKEN = "EAAQl6aAWMtgBAD6PJS9OYcdJtMJIkQZA247ZCTskM4MhTX4ecmudJ74ODxnvdCOP5a8fIVCNIlZB1mwozrrPemMOHrTjASe8CmZBS2BZCSZCothCcZCqKbZCaqdLH55BfxobHJBefSCsgzrgxG1I0AXAXaMD6ZBgEx1242332OgZCjxQZDZD"
// Imports dependencies and set up http server
const
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()),// creates express http server
  request = require('request');
  require('dotenv').config({path: __dirname + '/.env'})

app.use(express.static('public'));
app.set("view engine", "ejs");

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const APP_SECRET = process.env.APP_SECRET;

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening at '+ SERVER_URL));

function newOrder(sender_psid){
  let response = {
    "attachment":{
      "type":"template",
      "payload":{
        "template_type":"generic",
        "elements":[
           {
            "title":"Welcome!",
            "image_url":"https://petersfancybrownhats.com/company_image.png",
            "subtitle":"We have the right hat for everyone.",
            "default_action": {
              "type": "web_url",
              "url": SERVER_URL + "/order",
              "webview_height_ratio": "tall",
            },
            "buttons":[
              {
                "type":"web_url",
                "url": SERVER_URL + "/order",
                "title":"Place New Order",
                "webview_height_ratio": "compact",
                "messenger_extensions": true
              },{
                "type":"web_url",
                "url": SERVER_URL + "/cart",
                "title":"View Cart",
                "webview_height_ratio": "compact",
                "messenger_extensions": true
              }              
            ]      
          }
        ]
      }
    }
  }
  return response;
}

// Handles messages events
function handleMessage(sender_psid, received_message) {
  let response;
  
  // Checks if the message contains text
  if (received_message.text) {
        switch (received_message.text.replace(/[^\w\s]/gi, '').trim().toLowerCase()) {
            case "new order":
                response = newOrder(sender_psid);
                break;
            default:
                response = {
                    "text": `You sent the message: "${received_message.text}".`
                };
                break;
        }
    }
   else if (received_message.attachments) {
    // Get the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the right picture?",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes",
              },
              {
                "type": "postback",
                "title": "No!",
                "payload": "no",
              }
            ],
          }]
        }
      }
    }
  } 
  else {
        response = {
            "text": `Sorry, I don't understand what you mean.`
        }
    }
  // Send the response message
  callSendAPI(sender_psid, response);    
}



// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  let response;
  
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { "text": "Thanks!" }
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image." }
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}



// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  });
}

function callMessengerProfileAPI(sender_psid, response) {
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }
  request(
      {
        uri: "https://graph.facebook.com/v2.6/me/messenger_profile",
        qs: {
          access_token: PAGE_ACCESS_TOKEN
        },
        method: "POST",
        json: request_body
      },
      (error, _res, body) => {
        if (!error) {
          console.log("Request sent:", body);
        } else {
          console.error("Unable to send message:", error);
        }
      }
    );
}

app.get('/webhook', (req, res) => {

  const VERIFY_TOKEN = "bottechniche";

  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Check if a token and mode were sent
  if (mode && token) {

    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {

      // Respond with 200 OK and challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);

    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }

})

app.post('/webhook', (req, res) => {

  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === 'page') {

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {

      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }

    });

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

app.get('/order', (req,res) => {
   let body = req.body;
   let quer=req.query;
   //console.log(req);
   console.log('1');
   console.log(body);
   console.log('2');
   console.log(quer);
   console.log('3');
  //  let loading = {
  //   "text": `Loading....`
  //   };
  //   callSendAPI(body.psid,loading);
   res.render("products");
   //res.sendFile('public/products.html', {root: __dirname});
})
app.get('/cart', (req,res) => {
    res.render("cart");
    //res.sendFile('public/cart.html', {root: __dirname});
})

app.get('/optionspostback', (req,res) => {
  let body = req.query;
  let response = {
      "text": `Great, I will book you a ${body.bed} bed, with ${body.pillows} pillows and a ${body.view} view.`
  };
  res.status(200).send('Please close this window to return to the conversation thread.');
  console.log('heyy');
  console.log(body);
  console.log('hii');
  callSendAPI(body.psid, response);
})

app.get('/myapp',(req,res)=>{
  let body=req.body;
  console.log(body);
  res.status(200);
  let response = {
    "text": `heyyyy`
  };
  callSendAPI(body.ps_id,response);
})
