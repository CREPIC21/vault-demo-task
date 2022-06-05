// server framework for Node.js.
const express = require('express');
// loads environment variables from a .env file into process.env. 
const dotenv = require('dotenv');
// allows express to read the body and then parse that into a Json object that we can understand
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const tls = require('tls');
const { curly } = require('node-libcurl');
const {EOL} = require('os');

// Load env variables from config.env file
// dotenv.config({ path: './config/config.env' });

require("dotenv").config();

// using process.env because we configured env variables in config file
const PORT = process.env.PORT || 80;

const certFilePath = 'sandbox.pem';
const ca = 'tmp/vgs-outbound-proxy-ca.pem';
const tlsData = tls.rootCertificates.join(EOL);
const vgsSelfSigned = fs.readFileSync(certFilePath).toString('utf-8');
const systemCaAndVgsCa = tlsData + EOL + vgsSelfSigned;
fs.writeFileSync(ca, systemCaAndVgsCa);

// Initialize the app
const app = express();
// CORS 
app.use(cors({
    origin: "*"
}))

// set the view engine to ejs
app.set('view engine', 'ejs');

// Body parser - we need to add this middelware so we can use "req.body" to get data from the requests
// It works only if I add JSON.stringify, example: JSON.stringify(req.body)
app.use(express.json());

// Body parser
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }));

// Set static folder
app.use(express.static('public'));

app.get("/", (req, res) => {
    res.render('card');
});

app.post("/", async (req, res) => {
    const { cc_name, cc_number, cc_expiration_date, cc_cvc} = req.body;
    async function getData() {
    let result;
    

  try {
    result = await fetch('https://tntwbjfwonh.sandbox.verygoodproxy.com/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cc_name,
        cc_number,
        cc_expiration_date,
        cc_cvc
      }),
    });
  } catch (e) {
    console.error(e);
  }

  return await result.json();
}

const newData = await getData().then(response => {
    const cardNameRedacted = response.json.cc_name;
    const cardNumberRedacted = response.json.cc_number;
    const dateRedacted = response.json.cc_expiration_date;
    const cvcRedacted = response.json.cc_cvc;
    console.log(cardNameRedacted);
    res.render('redact', {cName: cardNameRedacted, cNumber: cardNumberRedacted, cDate: dateRedacted, cCVC: cvcRedacted});
    // res.send("Hello");
}); 
});

app.get("/redact", (req, res) => {
    res.render('redact');
})

app.post("/redact", async (req, res) => {

    const nameEncryted = req.body.cc_name;
    const numberRedacted = req.body.cc_number;
    const expDateRedacted = req.body.cc_expiration_date;
    const cvcRedacted = req.body.cc_cvc;
    console.log(nameEncryted);
    console.log(numberRedacted);
    console.log(expDateRedacted);
    console.log(cvcRedacted);
    async function run() {
        return await curly.post('https://echo.apps.verygood.systems/post', {
            postFields: JSON.stringify({ cc_name: nameEncryted, cc_number: numberRedacted, cc_expiration_date: expDateRedacted, cc_cvc: cvcRedacted }),
            httpHeader: ['Content-type: application/json'],
            caInfo: ca,
            proxy: 'https://USucTBo4LS5ftXpyUVb6uK7d:f10ee200-caa2-4bd7-88c4-9ae4565a6ab7@tntwbjfwonh.sandbox.verygoodproxy.com:8443',
            verbose: true,
        });
    }
    await run()
    .then(({ data, statusCode, headers }) => {
        const recData = JSON.parse(data.data);
        console.log(require('util').inspect(
            {
                data: JSON.parse(data.data),
                statusCode,
                headers,
            },
            null,
            4,
        ),
    ), 
    // res.send("Hello" + recData.cc_name);
    res.render('reveal', {cName: recData.cc_name, cNumber: recData.cc_number, cDate: recData.cc_expiration_date, cCVC: recData.cc_cvc})
   }).catch((error) => console.error(`Something went wrong`, { error }));
     // res.send("hell0");
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));