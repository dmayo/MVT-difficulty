import os
import csv
import json
import glob
import math
import redis
import string
import random

def get_image_sets(classes_to_images, num_images_per_task, num_image_sets):    
    image_sets = []
    classes = list(classes_to_images.keys())
    num_classes = len(classes)
    
    def finished(classes_to_images):
        for imgs in classes_to_images.values():
            if len(imgs):
                return False
        return True
    
    for _ in range(num_image_sets):
        image_set = []
        i = 0
        img_count = 0
        while img_count < num_images_per_task:
            if finished(classes_to_images):
                break
            label = classes[i % num_classes]
            i += 1
            if not classes_to_images[label]:
                continue
            random.shuffle(classes_to_images[label])
            image_set.append(classes_to_images[label].pop())
            img_count += 1
        image_sets.append(image_set)

    # if the final task is small, just distribute across the other tasks
    if len(image_sets[-1]) < (num_images_per_task / 2):
        random.shuffle(image_sets[-1])
        for i, img in enumerate(image_sets[-1]):
            image_sets[i % (len(image_sets) - 1)].append(img)
        image_sets.pop(-1)
        
    return image_sets

def get_video_orders(image_sets, images_to_videos, image_durations, num_participants, num_attention_checks):
    all_images = list(images_to_videos.keys())
    video_sets = []
    for image_set in image_sets:
        excluded_images = [img for img in all_images if img not in image_set]
        video_set = []
        for dur_idx in range(len(image_durations)):
            video_list = []
            for i, img in enumerate(image_set):
                dur = image_durations[(i  + dur_idx) % len(image_durations)]
                video_list.append(images_to_videos[img][dur])
            for i in range(num_attention_checks):
                sample_img = random.sample(excluded_images, 1)
                video_list.append(images_to_videos[img][600]) # add 10s attention check
            video_set.append(video_list)
        video_sets.append(video_set)

    video_orders = []
    for video_set in video_sets:
        video_order_list = []
        for video_list in video_set:
            for i in range(num_participants):
                vids = video_list[:]
                random.shuffle(vids)
                video_order_list.append(vids)
        video_orders.append(video_order_list)
    return video_orders

def make_link_ids(link_id_length, video_orders, video_data_filename, experiment_name):    
    def generate_link_id():
        return ''.join(random.SystemRandom().choice(string.ascii_lowercase + string.digits) for _ in range(link_id_length))

    experiment_entries = []
    for i in range(len(video_orders)):
        experiment_entries.append([generate_link_id(), {"video_data":video_data_filename, "order":"order_"+str(i), "experiment_name":experiment_name}])
    link_ids = [l[0] for l in experiment_entries]

    return link_ids, experiment_entries


    
def make_video_lists_and_link_csv(experiment_name, image_dir, num_images_per_task, num_participants, frame_counts, num_attention_checks):
    environment = os.environ

    EXPERIMENT_HOST = environment.get("EXPERIMENT_HOST")
    EXPERIMENT_PORT = environment.get("EXPERIMENT_PORT")
    REDIS_HOST = environment.get("REDIS_HOST")
    REDIS_PORT = environment.get("REDIS_PORT")
    REDIS_DB = environment.get("REDIS_DB")
    REDIS_PASSWORD = environment.get("REDIS_PASSWORD")


    cwd = os.getcwd()
    experiment_dir = os.path.join(cwd, f'{experiment_name}_data')
    video_dir = os.path.join(experiment_dir, 'videos')
    video_data_filename = os.path.join(experiment_dir, f'video_data_{experiment_name}.json')
    with open(video_data_filename, 'r') as f:
        video_data = json.load(f)['videos']
    video_data_filename = video_data_filename.split('/')[-1]

    images = [img.split('/')[-1] for img in glob.glob(os.path.join(image_dir, '*/*'))]
    num_images = len(images)


    # image_durations = list(set([v['image_duration'] for v in video_data]))
    image_durations = frame_counts
    classes = list(set([v['label'] for v in video_data]))
    
    num_classes = len(classes)
    num_image_sets = math.ceil(num_images / num_images_per_task)

    classes_to_images = {c: list(set([v['image'] for v in video_data if v['label'] == c])) for c in classes}
    
    images_to_videos = {img: {} for img in images}
    for v in video_data:
        img = v['image']
        dur = v['image_duration']
        images_to_videos[img][dur] = v['video']

    print('Building experiment sets and links...')
    image_sets = get_image_sets(classes_to_images, num_images_per_task, num_image_sets)
    video_orders = get_video_orders(image_sets, images_to_videos, image_durations, num_participants, num_attention_checks)

    for i, video_lists in enumerate(video_orders):
        order_dir = os.path.join(experiment_dir, 'video_orders', f'order_{i}')
        os.makedirs(order_dir, exist_ok=True)
        for j, video_list in enumerate(video_lists):
            with open(os.path.join(order_dir, f'{j}.json'), 'w') as f:
                json.dump(video_list, f)
            

    link_id_length = 8
    link_ids, experiment_entries = make_link_ids(link_id_length, video_orders, video_data_filename, experiment_name)
    
    base_link = f"https://{EXPERIMENT_HOST}:{EXPERIMENT_PORT}/experiment.html?link="
    links = []
    for link_id in link_ids:
        links.append([base_link+str(link_id)])

    with open(experiment_name+"_links.csv", "w") as f:
        writer = csv.writer(f)
        writer.writerow(['HIT_Link'])
        writer.writerows(links)

    # log link_ids with relevant metadata (data json, video lists, etc) in redis

    r = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        charset="utf-8",
        decode_responses=True,
        password=REDIS_PASSWORD,
        db=REDIS_DB
    )

    for i in range(len(experiment_entries)):
        r.hmset(experiment_entries[i][0], experiment_entries[i][1])
        r.sadd(experiment_name,experiment_entries[i][0])
    

if __name__ == "__main__":
    # TODO argparser
    EXPERIMENT_NAME = 'toy_folder'
    IMAGE_DIR = '/storage/jecummin/datasets/toy_image_folder'
    NUM_IMAGES_PER_TASK = 4
    NUM_PARTICIPANTS = 7 # the number of participants to do each task
    make_video_lists_and_link_csv(EXPERIMENT_NAME, IMAGE_DIR, NUM_IMAGES_PER_TASK, NUM_PARTICIPANTS)
