const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const https = require('https');
const app = express();

app.set('trust proxy', true);
app.use(cookieParser());

const gaClient = axios.create({
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 200 }),
    timeout: 10000
});

const TARGET_URL = "https://www.zenithummedia.com/case-studies?utm_source=google&utm_medium=medium&utm_campaign=OG&utm_id=Visit_frame";
const MEASUREMENT_ID = "G-SNCY0K36MC";


async function runServerSideTracking(ids) {
    //const initialBuffer = 5000;

    console.log(`pv started ...`)
    await sendPing(ids, 'page_view1', { 
        '_et': 0
    })
    console.log("pv ended ...")

    const scrollDelay1 = Math.floor(Math.random() * (25000 - 20000 + 1) + 20000);

    await new Promise(resolve => setTimeout(resolve, scrollDelay1));
    console.log(`Scroll started in ${scrollDelay1} sec`)
    await sendPing(ids, 'scroll', { 
        'epn.percent_scrolled': 90,
        '_et': scrollDelay1.toString()
    })
    console.log(`Scroll endeded ...`)

    const scrollDelay2 = Math.floor(Math.random() * (100000 - 90000 + 1) + 90000);

    await new Promise(resolve => setTimeout(resolve, scrollDelay2));
    console.log(`Final session started in ${scrollDelay2} sec`)
    await sendPing(ids, 'final_session', { 
        '_et': scrollDelay2.toString()
    })
    console.log(`Final session ended`)

}

async function sendPing(ids, eventName, extraParams = {}) {

    const params = new URLSearchParams({
        v: '2', 
        tid: MEASUREMENT_ID, 
        cid: ids.clientId, 
        sid: ids.sessionId,
        uip: ids.userIp, 
        _uip: ids.userIp, 
        dl: TARGET_URL, 
        en: eventName,
        seg: '1', 
        _dbg: '1', 
        ...extraParams
    });
    try {
        await gaClient.get(`https://www.google-analytics.com/g/collect?${params.toString()}`, {
            headers: { 
                'User-Agent': ids.userAgent, 
                'X-Forwarded-For': ids.userIp 
            }
        });
    } catch (e) {}
}


app.all('/', (req, res) => {
    const userIp = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().replace('::ffff:', '');
    const userAgent = req.headers['user-agent'] || 'Mozilla/5.0';

    const gaCookie = req.cookies['_ga'] || '';
    const clientId = gaCookie.split('.').slice(-2).join('.') || `100.${Date.now()}`;
    
    const sidKey = `_ga_${MEASUREMENT_ID.slice(2)}`;
    const sessionCookie = req.cookies?.[sidKey] || '';
    const sessionId = sessionCookie.split('.')[2] || Math.round(Date.now() / 1000).toString();
    
    // We don't have cookies yet because the browser hasn't hit us.
    // We generate temporary IDs to pass to the server worker.
    const ids = {
        clientId: clientId,
        sessionId: sessionId,
        userIp,
        userAgent
    };

    // Start server-side pings in background
    runServerSideTracking(ids);

    // Send the "Anchor" page to the user
    const html = (`
        <html>
        <head>
            <script async src="https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}"></script>
            <script>
                window.dataLayer = window.dataLayer  [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                // This call in the browser FIXES the location to India
                gtag('config', '${MEASUREMENT_ID}', { 
                    'client_id': '${ids.clientId}',
                    'session_id': '${ids.sessionId}',
                    'page_location': '${TARGET_URL}',
                    'debug_mode': true 
                });
                'event_callback': function() {
                   console.log('GA4 confirmed Page View. Signaling server...');
                }
                fetch('/?cid=${ids.cid}&sid=${ids.sid}');
            </script>
        </head>
        <body style="background:#000; color:#fff; display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
            <div>Redirecting to Case Studies...</div>
            <script>
                setTimeout(function(){ window.location.href = "${TARGET_URL}"; }, 800);
            </script>
        </body>
        </html>
    `);
    res.send(html);
});

app.listen(3000, () => console.log('Verifier with Warm-up Ping active on port 3000'));