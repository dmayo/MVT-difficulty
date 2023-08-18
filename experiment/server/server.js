const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require("path");
const compression = require('compression');
const express = require('express');
const formidable = require('formidable');
const tus = require('tus-node-server');
var Promise = require("bluebird");
const redis = Promise.promisifyAll(require('redis'));
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');



let REDIS_HOST = process.env.REDIS_HOST;
let REDIS_PORT = parseInt(process.env.REDIS_PORT);
let REDIS_PASSWORD = process.env.REDIS_PASSWORD;
let REDIS_DB = parseInt(process.env.REDIS_DB);
let EXPERIMENT_PORT = parseInt(process.env.EXPERIMENT_PORT);
let SERVER_PRIVATE_KEY_FILE = process.env.SERVER_PRIVATE_KEY_FILE;
let SERVER_CERTIFICATE_FILE = process.env.SERVER_CERTIFICATE_FILE;
let NUM_VIDEO_LISTS_PER_LINK = fs.readdirSync('../public/experiment_data/video_orders/order_0').length;
const video_list = require('../public/experiment_data/video_orders/order_0/0.json')
let NUM_IMAGES_PER_TASK = video_list.length;

let redisOptions = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
}
let redisClient = redis.createClient(redisOptions);
redisClient.selectAsync(REDIS_DB);


let allotted_time = 4 * 60 * 60 * 1000// 3 hours
let max_contribution = 4 // number of tasks workers can do

const app = express();

app.use(compression());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));


const unique = (value, index, self) => {
  return self.indexOf(value) === index
}


//static file server on https
app.use(express.static(path.join(__dirname, '../public')))

app.post('/submit_response', function (req, res) {
    /*
      Records a workers response along with some additional information.
    */
    let data = {"link_id": req.body.link_id,
                "trial_num": req.body.trial_num,
                "video_num": req.body.video_num,
		 "video": req.body.video,
                 "response": req.body.response,
                 "response_time": req.body.response_time,
                 "total_elapsed_time": req.body.total_elapsed_time,
                "video_height": req.body.video_height,
                 "view_distance": req.body.view_distance,
                 "px2mm": req.body.px2mm,
                 "screen_width_px": req.body.screen_width_px,
                 "screen_height_px": req.body.screen_height_px,
                 "window_width_px": req.body.window_width_px,
                 "window_height_px": req.body.window_width_px,
                 "device_pixel_ratio": req.body.device_pixel_ratio,
                 "color_depth": req.body.color_depth,
                "user_agent": req.body.user_agent,
		"IP": req.connection.remoteAddress,
                "assignment_id": req.body.assignment_id,
		"hit_id": req.body.hit_id,
		"worker_id": req.body.worker_id,
               }
    console.log(data);
    redisClient.hmsetAsync(req.body.link_id+":worker_id:"+req.body.worker_id+":response:"+req.body.trial_num,data);
    redisClient.saddAsync(req.body.link_id+":worker_id:"+req.body.worker_id+":responses",req.body.trial_num);
    res.end();
})


app.get('/check_worker', async function (req, res) {
    /*
      Checks to see if a worker is eligible to accept the HIT When a
      worker views the HIT, the HIT loading page stalls while this
      function is run.  If the worker's ID is a member of the
      `blocked_worker_ids` set in redis or they have contributed more than
      `max_contribution` tasks, then the worker is turned away and
      cannot accept the HIT.
    */
    let workerID = String(req.query['workerID']);
    let linkID = String(req.query['linkID']);
    let workerCheck=await redisClient.sismemberAsync('blocked_worker_ids', workerID);
    let previousWork = await redisClient.existsAsync(workerID + ':links');
    let contribution = await redisClient.scardAsync(workerID + ':links');
    if (contribution >= max_contribution) {
	workerCheck = true
    }
    let linkCheck = 0;
    if (previousWork==1) {
        linkCheck=await redisClient.sismemberAsync(workerID + ':links', linkID);
    }

    if (linkCheck==1) { workerCheck = true }
    
    console.log('Checking worker', workerID, '...');;
    res.send(req.query.callback + '('+ JSON.stringify({"worker": ! workerCheck, "link": linkCheck}) + ');');
});

app.post('/get_data', async function (req, res) {
    /*
      Gets the list of videos associated with this task. If the worker
      is resuming the task, their most recent response is fetched for
      them.
    */
    console.log('Getting data')
    console.log(req.body);
  let responses = await redisClient.smembersAsync(req.body.link+":worker_id:"+req.body.d+":responses");
  let last_response = -1;
  if(responses.length>0){
    last_response = Math.max(...responses.map(Number));
  }
    console.log(await redisClient.hgetallAsync(req.body.link));
    res.send([await redisClient.hgetallAsync(req.body.link),last_response+1]);

})

app.post('/update_timestamp', async function (req, res) {
    /*
      Updates the timestamp of a worker's task.
     */
    let response = await redisClient.hmsetAsync(req.body.assignment_id+":timestamp", req.body.timestamp)
    res.send([response])
})

app.post('/get_order_num', async function (req, res) {
    /* 
       After a worker has been verified and has accepted a HIT, we match the
       assignment ID with a video list associated with the task link
       ID. The process is not super straightforward so it's worth
       explaining in more detail.

       After running generate_experiment_sets.py, task images are
       batched into sets of `NUM_IMAGES_PER_TASK` each of which is
       associated with a link ID. That is, each link corresponds to
       `NUM_IMAGES_PER_TASK` images and the sets of images assigned to
       different links are disjoint. Then, the sets of images are
       converted into lists of experiment videos containing each
       image. Video lists are generated such that each image is shown
       at each experiment presentation time (specified in
       generate_videos.py) as many times as the intended number of
       responses (specified in generate_experiments.py). So, for
       example, if we wanted each image to be seen at 6 different
       durations by 7 different workers, then we make 7 * 6 = 42 video
       lists such that after all 42 assignments are completed, each
       image has been seen at each duration by 7 distinct workers.

       This complicated scheme is important because in this paradigm,
       a link is posted on MTurk as a task and a worker do the task
       one time. If the worker decides to do another task, it must be
       with a different link, so therefore the images shown in the
       videos will be distinct and the worker can never see the same
       image twice (i.e. we can't make each video list its own task
       because workers may see the same image in different tasks). But
       each time a new worker accepts an assignment associated with
       this link, we need to match the assignment ID with one of the
       video lists that we have prepared for this link so that we
       ensure that all the videos are seen. This is the purpose of
       this function.

       We keep a list of assignments that have been accepted with 
       this link ID and assignments are matched with a video list 
       based on its placement in the assignment list. When a worker 
       accepts a HIT, we go through the list to find the next 
       available video list to match them with. If there are 
       assignments that need to be redone (e.g. expired and 
       unfinished, or otherwise need replaced), then we replace the 
       old bad assignment with the new one in the list. Otherwise, 
       we append the new assignment to the list and match the 
       assignment with video list number = (length of assignment 
       list) % (number of video lists).
    */
    let order_num = 0
    let assignment_ids = await redisClient.lrangeAsync("assignment_ids:" + req.body.link_id, 0, -1);
    let found = false;
    // If the assignment ID is newly accepted, then assign it a
    // new video list associated with this link by iterating through the
    // video list numbers and assigning it the next available
    if (assignment_ids.length == 0 || ! assignment_ids.includes(req.body.assignment_id)){
	for (let i = 0; i < assignment_ids.length; i++){
	    let bad_assignment = false;
	    let timestamp_data = await redisClient.hgetallAsync(assignment_ids[i] + ":timestamp")
	    bad_assignment = await redisClient.sismemberAsync('assignments_to_replace', assignment_ids[i]);

	    // If an assignment in the list is unfinished and expired
	    // assign its video list to this assignment
	    if (! bad_assignment && !(timestamp_data == null || ! ("start_time" in timestamp_data))) {	

		let start_time = timestamp_data["start_time"]
		let trial_num = timestamp_data["trial_num"]
		let current_time = new Date().getTime();
		let elapsed_time = current_time - start_time
		if (trial_num < NUM_IMAGES_PER_TASK - 1 && elapsed_time  > allotted_time){
		    bad_assignment = true;
		}
	    }

	    // If an assignment is marked for replacement, assign its video list to this assignment
	    if (bad_assignment && ! found) {
		redisClient.lsetAsync("assignment_ids:" + req.body.link_id, i, req.body.assignment_id);
		order_num = i
		found = true;

	    }
	}
	// If no replacements are found, the assignment is appended to the
	// list and ther order number is the list length modulo number of video lists
	if (! found) {
	    redisClient.rpushAsync("assignment_ids:" + req.body.link_id, req.body.assignment_id);
	    order_num = assignment_ids.length % NUM_VIDEO_LISTS_PER_LINK; // TODO add modulo number of videos
	    assignment_ids.push(req.body.assignment_id);
	}
	console.log('order', order_num);
	let current_time = new Date().getTime();
	let timestamp = await redisClient.hmsetAsync(req.body.assignment_id+":timestamp", {"trial_num": 0,
											   "start_time": current_time});
    } else { 
	// if the assignment is still active, fetch its assigned order number
	order_num = assignment_ids.indexOf(req.body.assignment_id) % NUM_VIDEO_LISTS_PER_LINK;
	console.log('order', order_num);
    }
    res.send([order_num]);
})

//handle 404
app.use(function(req, res) {
    res.status(404).send('404: Page not found');
});


var privateKey = fs.readFileSync(SERVER_PRIVATE_KEY_FILE, 'utf8');
var certificate = fs.readFileSync(SERVER_CERTIFICATE_FILE, 'utf8');
var credentials  = {key: privateKey, cert: certificate};

var port = process.env.EXPERIMENT_PORT;
var httpsServer = https.createServer(credentials, app);

httpsServer.listen(port,function(err){
    if(!err) {
        console.log('HTTPS server listening on port : ' + port);
    }
});
