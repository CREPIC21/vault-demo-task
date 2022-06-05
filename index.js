// server framework for Node.js.
const express = require('express');
// allows express to read the body and then parse that into a Json object that we can understand
const bodyParser = require('body-parser');
// package for providing a Connect/Express middleware that can be used to enable CORS with various options
const cors = require('cors');

// Required packages for VGS Task
const fetch = require('node-fetch');
const fs = require('fs');
const tls = require('tls');
const { curly } = require('node-libcurl');
const {EOL} = require('os');

// for accessing environment variables
require("dotenv").config();

const PORT = process.env.PORT || 80;
const SANDBOX_USERNAME = process.env.SAND_USERNAME;
const SANDBOX_PASSWORD = process.env.SAND_PASSWORD;
const VAULT_ID = process.env.VAULTID;
const CERT_PATH = process.env.NODE_EXTRA_CA_CERTS;
console.log(SANDBOX_USERNAME);

const certFilePath = CERT_PATH;
const ca = 'tmp/vgs-outbound-proxy-ca.pem';
const tlsData = tls.rootCertificates.join(EOL);
const vgsSelfSigned = fs.readFileSync(certFilePath).toString('utf-8');
const systemCaAndVgsCa = tlsData + EOL + vgsSelfSigned;
fs.writeFileSync(ca, systemCaAndVgsCa);

// Initialize the app
const app = express();
// enable cors
app.use(cors({
    origin: "*"
}))

// set the view engine to ejs
app.set('view engine', 'ejs');

// Body parser - we need to add this middelware so we can use "req.body" to get data from the requests
app.use(express.json());

// Body parser
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }));

// Set static folder
app.use(express.static('public'));

app.get("/", (req, res) => {
    res.render('card');
});

// Inbound route
app.post("/", async (req, res) => {
    const { cc_name, cc_number, cc_expiration_date, cc_cvc} = req.body;
    async function getData() {
    let result;
  try {
    result = await fetch(`https://${VAULT_ID}.sandbox.verygoodproxy.com/post`, {
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
}); 
});

// Outbound route
app.post("/redact", async (req, res) => {
    const nameRedacted = req.body.cc_name;
    const numberRedacted = req.body.cc_number;
    const expDateRedacted = req.body.cc_expiration_date;
    const cvcRedacted = req.body.cc_cvc;
    async function run() {
        return await curly.post('https://echo.apps.verygood.systems/post', {
            postFields: JSON.stringify({ cc_name: nameRedacted, cc_number: numberRedacted, cc_expiration_date: expDateRedacted, cc_cvc: cvcRedacted }),
            httpHeader: ['Content-type: application/json'],
            caInfo: ca,
            proxy: `https://${SANDBOX_USERNAME}:${SANDBOX_PASSWORD}@${VAULT_ID}.sandbox.verygoodproxy.com:8443`,
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
    res.render('reveal', {cName: recData.cc_name, cNumber: recData.cc_number, cDate: recData.cc_expiration_date, cCVC: recData.cc_cvc})
   }).catch((error) => console.error(`Something went wrong`, { error }));
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));