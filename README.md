# MVT-difficulty
This repo contains a code toolbox for running tasks on Amazon
Mechanical Turk for computing Minimum Viewing Time (MVT)  as presented in (TODO cite paper). 

## Overview

MVT is a measure of image recognition difficulty that is grounded in
human psychophysics. It is defined as the minimum amount of time that
a human needs to see an image in order to recognize it. For example,
if an image has an MVT of 100ms, then humans on average are unable to
reocognize the image if they see it for less than 100ms, but they can
recognize it if they see the image for at least 100ms. MVT is gathered
by showing images to people with various durations and asking the
people to guess what they saw in the image.

The experimental design is a little complicated so in the following
sections we go over on a high-level how the experiment stimuli are
made, how tasks are posted, and how responses are stored.

### Converting images to videos

First, we convert the experiment images into videos that will get
embedded in the tasks. In each video there is a fixation cross for 500ms, the image stimulus
for some varied duration, then a backward mask for 500ms. The
backwards masks are made by randomizing the phase component of the
experiment stimulus in the Fourier domain and then recombining it with
the amplitude component.

The user specifies which image presentation durations they would like
to make videos for. In the original MVT experiments, images were shown
for 17ms, 50ms, 100ms, 150ms, 250ms, 10s. The user specifies these
durations by passing a list of frame counts. Videos are made to be 60
frames per second as the standard computer monitor runs at 60Hz so 1
frame = 1 / 60s = ~17ms. A video is made displaying each image for
each of the desired number of frames.

### Grouping videos for MTurk tasks

After the videos are made, we need to group videos together to be
shown in the MTurk tasks. We allow workers to do multiple tasks, but
go to lengths to ensure that no worker sees the same image more than
once. If worker see an image more than once, it may improve their
ability to recognize it which would confound the MVT results.

First, we group the experiment images into disjoint, class-balanced
sets with size specified by the user (say, 50). Then, for each set of
images, we create lists of videos that will be shown to the
workers. If the user would like $W$ workers to see each image at each
of the $D$ durations, then we create $W \times D$ sets of videos. The
video lists have 50 videos, one for each of the images in their
assigned set, balanced over all $D$ durations and shown in a random
order. The $W \times D$ video lists collectively contain each of the
50 images $W$ times at each of the $D$ timings.

Then, each set of images is assigned a URL to the app running on the
experiment host. These links are uploaded to MTurk as tasks for
workers to accomplish by following the link. Each task should have $W
\times D$ workes complete it. On the backend, we ensure that each time
a new worker accepts the task, they are shown a new list of videos
that has not been shown yet. See the documentation in
`experiment/server/server.js` for more information on how this is
done.

This procedure is important because it ensures that each link (task)
only ever shows the same images, and no two assignment from different
tasks contain any of the same images. That way, workers can complete
multiple tasks that we post, but will not accidentally see the same
image twice at any duration.

### Uploading tasks to MTurk

We have set up this toolkit to use the MTurk web application rather
than the API for improved transparency. MTurk on the web makes
following task progress, creating hits, and managing tasks more
convenient and less bug-prone.

First, the user sets up the project and task landing page. We've
included the starter code for this. Then, they upload a CSV of links
to post the tasks for workers to complete. Each link is one task, but
each task can have multiple assignments so that multiple workers can
complete a single task. MTurk disallows workers from performing
multiple assignments from the same task. As explained in the previous
section, each assignment is associated in the backend with a different
set of videos so as different workers accept assignments from the same task
(link), they see the same images but at different presentation times.

We've included in the landing page a callback to the experiment server
to check to see if the worker should be allowed to accept this
task. The 'Accept HIT' button is hidden until this check is
completed. If the worker has already completed an assignment with this
link, or if the worker is on a list of blocked workers stored in the
backend, then the 'Accept HIT' button remains hidden and the worker is
instructed to return the HIT. Otherwise, the button is made visible
and the worker is able to proceed. This direct
interaction with the experiment server from the MTurk server requires
a secure connection so the experiment server must have HTTPS credentials.

### Redis Backend

Results are stored in a Redis backend with the following key-value structure:

* `<link_id`: Task metadata including the path to video list files for
  this particular link.

* `<link_id>:worker_id:<worker_id>:response:<trial_number>`: Set
containing worker response and metadata for the video in the
`trial_number` video in the task.

* `<link_id>:worker_id:<worker_id>:responses`: Set of `trial_numbers` of
videos that the worker has completed for this link. This is used to
keep track of the worker's progress and allow them to resume where
they left off after a break.

* `<worker_id>:links`: A list of links that the worker has accepted
  assignments for. This is used to ensure that the worker is not able
  to accept an assignment from a link they have already seen.

* `blocked_worker_ids`: A set of workers that have been
  blocked. Workers in this set are no longer allowed to accept more
  HITs.

* `assignment_ids:<link_id>`: A list of assignments that have been
  accepted for this link. The order of these assignments are used to
  select which list of videos are to be shown to the worker.

* `assignments_to_replace`: A set of assignment IDs that need
  redone. When assigning a worker to a video list, previous
  assignments that are in this set are replaced by the assignment ID
  of the new worker. We recommend the user put in this set all
  assignment IDs from workers who did not pass the quality control.

* `<assignment_id>:timestamp`: The timestamp of the most recently
  submitted response from this assignment. This keeps track of which
  assignments are expired. Assignments that are not completed and
  expired are reposted by MTurk automatically and will be replaced in
  the backend when new assignments are accepted for that link.


## Steps for running MVT experiments

### Set up the environment

These steps presume that you have set up redis and it is running on a
machine and port that is discoverable to the experiment host.

1. Install requirements.

```(bash)
$ pip install -r requirements.txt
```

2. Set environment variables. Edit the `set_environment.sh` file to
include the necessary information. The environment variables that need
to be set are as follows:
* `EXPERIMENT_HOST`: The host where the experiment server is
running
* `EXPERIMENT_PORT`: The port the experiment server is running on
* `REDIS_HOST`: The hostname of the machine that redis is running on
* `REDIS_PORT`: The port that redis is listening to
* `REDIS_DB`: The redis database number that the responses will be
stored to
* `REDIS_PASSWORD`: The password for accessing redis
* `SERVER_PRIVATE_KEY_FILE`: The path to the server HTTPS public key
* `SERVER_CERTIFICATE_FILE`: The path to the server HTTPS certificate

```(bash)
$ source set_environment.sh
```

### Generate experiment stimuli

Experiment stimuli, video lists, and task metadata files are generated
by running `main.py` which requires a few command line arguments.

* `image_directory`: The path to the directory containing the
  experiment images. The directory should be in [PyTorch Image
  Folder
  format](https://pytorch.org/vision/stable/generated/torchvision.datasets.ImageFolder.html)
  with human-readable names for class directories.

* `--experiment_name`: The name of this experiment.

* `--frame_counts`: List of integers separated by spaces. The numbers
  correspond to the number of frames that you would like images to be
  present at. 1 frame is 1/60 of a second.

* `--num_images_per_task`: The number of images included in each task
  for workers to complete.

* `--num_workers`: The number of workers who will see each image at
  each duration in `frame_counts`.

Here's an example with the same configuration as the original MVT experiments:

```(bash)
$ python main.py /path/to/image/folder/ --experiment_name example_experiment
--frame_counts 1 3 6 9 15 600 --num_images_per_task 50 --num_workers 7
```

### Start experiment server

Navigate to the experiment server folder.

```(bash)
$ cd experiment/server
```
There are two fields in `server.js` that you may want to edit before you start the
server.

* `allotted_time`: The amount of time (in milliseconds) that
  a worker has to complete a task before it expires. This should match
  the value you set when making the MTurk task on the MTurk web app.

* `max_contribution`: The maximum number of tasks a worker can
  do. This number limits the bias in your data by restricting workers
  from doing too many tasks.

Start your experiment server:

```(bash)
$ npm install
$ node server.js
```

If everything has worked properly, you should be able to go to
[https://<EXPERIMENT_HOST>:<EXPERIMENT_PORT>/experiment.html?link=<LINK_ID>&b=ASSIGNMENT_ID&c=HIT_ID&d=WORKER_ID](https://<EXPERIMENT_HOST>:<EXPERIMENT_PORT>/experiment.html?link=<LINK_ID>&b=ASSIGNMENT_ID&c=HIT_ID&d=WORKER_ID)

after formatting in your experiment hostname, port number, and any of
the link_ids found in `<EXPERIMENT_NAME>_links.csv` and you will be
able to try out the experiment yourself.

### Set up MTurk Task

Next, you need to go to the [MTurk Requester
page](https://requester.mturk.com/) and create a new project with the
default template. Fill out the project properties to your liking. In
our in-lab experiments, participants spent around an hour to do 200
images which you can use to estimate a reasonable reward. We encourage
everyone who uses our code to comply with minimum wage regulation and
to be generous in their MTurk rewards. For "Number of assignments per
task", input the number of video lists per link (number of workers *
number of image durations).

Then, delete everything in Design Layout and replace it with the
contents of `mturk_landing_page.html`. Save the project and go back to
the "Create" page.

### Upload MTurk links

To post your experiments for MTurk workers to complete, press "Publish
Batch" on your new project and upload
`<EXPERIMENT_NAME>_links.csv`. This file contains all the URLs for
your experiment. It may be quite large depending on how many images
you are using so you may not want to upload it all at once. In that
case, you can split up the file into smaller ones and upload them
separately as long as the first row in each file is `HIT_Link`.

## Analysis notebook

We've provided a small notebook for you keep track of your data as it
come in from MTurk. `analyze_results.ipynb` allows you to build a
dataframe of responses and keep track of which tasks need reposted in
order to complete the whole experiment. We recommend removing the
results from workers with poor performance at long control durations
and marking their assignments for replacement. To replace those
assignments after marking them in redis, just upload a CSV file the
the relevant link ids to MTurk after changing the "Number of
assignments per task" project property to match the number of
assignments you want replaced.
  
  
