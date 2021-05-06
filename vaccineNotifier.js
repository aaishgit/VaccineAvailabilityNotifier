require('dotenv').config()
const moment = require('moment');
const cron = require('node-cron');
const axios = require('axios');
const notifier = require('./notifier');
/**
Step 1) Enable application access on your gmail with steps given here:
 https://support.google.com/accounts/answer/185833?p=InvalidSecondFactor&visit_id=637554658548216477-2576856839&rd=1

Step 2) Enter the details in the file .env, present in the same folder

Step 3) On your terminal run: npm i && pm2 start vaccineNotifier.js

To close the app, run: pm2 stop vaccineNotifier.js && pm2 delete vaccineNotifier.js
 */

const PINCODE = process.env.PINCODE
const FROMEMAIL = process.env.EMAIL
const AGE = process.env.AGE
const DISTRICT_EMAIL_MAP = { "aaishsindwani@gmail.com": [507] }


async function main(){
    try {
        cron.schedule('* * * * *', async () => {
             await checkAvailability();
        });
    } catch (e) {
        console.log('an error occured: ' + JSON.stringify(e, null, 2));
        throw e;
    }
}

async function checkAvailability() {

    let datesArray = await fetchNext2Days();
    console.log("Checking slots at "+new Date().toLocaleString());
    datesArray.forEach(date => {
        getSlotsForDate(date);
    })
}

function getSlotsForDate(DATE) {
    for(let email in DISTRICT_EMAIL_MAP){
        console.log("Email: "+email)
        
	//let pincodes = PINCODE.split(',');
         DISTRICT_EMAIL_MAP[email].forEach(district => {
            let config = {
                method: 'get',
                url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=' + district + '&date=' + DATE,
                headers: {
                    'accept': 'application/json',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36'
                }
            };

            axios(config)
                .then(function (slots) {
                    let centers = slots.data.centers;
                    let validCenters = [];
                    //console.log(centers[0])
                    centers.forEach(function (centre, index) {
                        let validSlots = centre.sessions.filter(slot => slot.min_age_limit <= AGE &&  slot.available_capacity > 0)
                        centre.sessions = validSlots;
                        if(validSlots.length>0){
                            validCenters = validCenters.concat(centre);
                        }
                    })
                    
                    console.log({date:DATE, validSlots: validCenters.length, district:district, age:AGE});
                
                    //console.log(validSlots);
                    if(validCenters.length > 0) {
                        notifyMe(validCenters, email);
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
    	   });
        }
    }

async function notifyMe(validSlots, email){
    let slotDetails = JSON.stringify(validSlots, null, '\t');
    notifier.sendEmail(FROMEMAIL, 'VACCINE AVAILABLE', slotDetails, email, (err, result) => {
        if(err) {
            console.error({err});
        }
    })
};

async function fetchNext2Days(){
    let dates = [];
    let today = moment();
    for(let i = 0 ; i < 2 ; i ++ ){
        let dateString = today.format('DD-MM-YYYY')
        dates.push(dateString);
        today.add(1, 'day');
    }
    return dates;
}



main()
    .then(() => {console.log('Vaccine availability checker started.');
                console.log(DISTRICT_EMAIL_MAP);});
