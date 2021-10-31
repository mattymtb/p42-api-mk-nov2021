const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const jwtAuthz = require('express-jwt-authz');
var ManagementClient = require('auth0').ManagementClient;

const app = express();

const port = process.env.PORT || 3001;
const appPort = process.env.A0_SERVER_PORT || 3000;
const appOrigin = process.env.A0_APPORIGIN || `http://localhost:${appPort}`;


if (
    !process.env.A0_DOMAIN
    || !process.env.A0_MIDDLEWARE_CLIENT_ID
) {
    console.log(
        "Exiting: Please make sure that the Auth0 environment variables have been set correctly"
    );

    process.exit();
}

app.use(morgan("dev"));
app.use(helmet());
app.use(cors({ origin: appOrigin }));
app.use(express.json());

const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.A0_DOMAIN}/.well-known/jwks.json`,
    }),

    audience: process.env.A0_AUDIENCE,
    issuer: `https://${process.env.A0_DOMAIN}/`,
    algorithms: ["RS256"],
});

app.get("/api/test", (req, res) => {
    res.send({
        msg: "p42-api-mk is up and running!",
    });
});

const mergeHistory = (arr1, arr2) => {
    let tempArr = arr1.concat(arr2);
    return tempArr.filter((item, pos) => tempArr.indexOf(item) === pos)
}


var auth0Client = new ManagementClient({
    domain: process.env.A0_DOMAIN,
    clientId: process.env.A0_MIDDLEWARE_CLIENT_ID,
    clientSecret: process.env.A0_MIDDLEWARE_CLIENT_SECRET,
    scope: "read:users update:users"
});

const scopeCheck = jwtAuthz(['create:pizzaorder']);

app.post("/api/orders", checkJwt, scopeCheck, async (req, res, next) => {

    try {

        const params = { id: req.user.sub };
        // console.log("here is req.user:" + JSON.stringify(req.user));
        // console.log("here is req.bod:" + JSON.stringify(req.body));
        console.log("about to try and readUser");
        let userMeta = await auth0Client.getUser(params);
        console.log("Here is user meta:" + JSON.stringify(userMeta))


        let orderHistory = [];
        orderHistory.push(req.body.item);

        if (userMeta?.user_metadata?.prior_orders) {
            orderHistory = mergeHistory(orderHistory, userMeta.user_metadata.prior_orders);
        }


        let appMetadata = {
            prior_orders: orderHistory
        };


        let resp = await auth0Client.updateUserMetadata(params, appMetadata);

        if (resp.error) {
            res.status(400).send({
                msg: "error updating user metadata"
            });
        }

        res.send({
            msg: "Order successful!",
            pizza: req.body.item
        });

    } catch (err) {

        res.status(400).send({
            msg: "Something went wrong",
            error: err
        });

        next(err);
    }

});

app.listen(port, () => console.log(`API Server listening on port ${port}`));
