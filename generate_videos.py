import os
import cv2
import glob
import json
import shutil
import random
import collections
import numpy as np
import multiprocessing
import moviepy.editor as moviepy

from tqdm import tqdm as tqdm
from PIL import Image, ImageDraw
from phase_scramble import make_phase_masks

def get_concat_h(im1, im2):
    dst = Image.new('RGB', (im1.width + im2.width, im1.height))
    dst.paste(im1, (0, 0))
    dst.paste(im2, (im1.width, 0))
    return dst

def create_cross_image(image_size):
    im = Image.new('RGB', image_size, color=(255,255,255))
    draw = ImageDraw.Draw(im)
    width, height = im.size
    draw.line((width*3/8, height/2) + (width*5/8, height/2), fill=(0,0,0), width=4)
    draw.line((width/2, height*3/8) + (width/2, height*5/8), fill=(0,0,0), width=4)
    return im

def create_white_mask_image(image_size):
    im = Image.new('RGB', image_size, color=(255,255,255))
    return im

def get_classes(stimuli_dir):

    class_names = os.listdir(stimuli_dir)

    experiment_images = glob.glob(stimuli_dir+"/**/*")
    experiment_images = [x for x in experiment_images if x.split('/')[-2] in class_names]

    experiment_images_to_class = {}
    experiment_images_by_class = collections.defaultdict(list)
    for img in experiment_images:
        experiment_images_to_class[img] = img.split('/')[-2]
        experiment_images_by_class[img.split('/')[-2]].append(img)

    response_options = sorted(class_names)
    
    return {
        'images_to_class': experiment_images_to_class,
        'class_to_images': experiment_images_by_class,
        'response_options': response_options,
            }


video_data = []

def crop_img(img):
    w, h = img.shape[:2]
    w_offset = int((w - 672) / 2)
    h_offset = int((h - 672) / 2)
    new_img = img[w_offset : w - w_offset , h_offset : h - h_offset]
    return new_img

def frames_to_videos(args):
    cross_image, experiment_images, mask_info, white_mask, duration_samples, image_to_label, response_options, experiment_dir = args[:8]
    mask_image = mask_info[0]
    mask_type = mask_info[1]
    cross_img = cv2.imread(cross_image)
    cross_img = cv2.resize(cross_img, (672, 672))
    mask_img = cv2.imread(mask_image)
    
    mask_img = cv2.resize(mask_img, (672, 672))
    white_img = cv2.imread(white_mask)

    white_img = cv2.resize(white_img, (672, 672))
    
    if mask_type == 'bw_phase':
        mask_img = cv2.cvtColor(mask_img, cv2.COLOR_BGR2GRAY)
        
    for i in range(len(duration_samples)):
        
        experiment_image = experiment_images[0]
        experiment_img = cv2.resize(cv2.imread(experiment_image), (672, 672))

        correct_label = image_to_label[experiment_image]
        
        duration = duration_samples[i]
 
        file_name = experiment_image.split('/')[-1].split('.')[0]+ \
            "_phase_" + ("_".join([str(s) for s in duration]))

        
        save_path = os.path.join(experiment_dir, f"videos/" + file_name + ".avi")

        frame_width = 672
        frame_height = 672
       
        size = (frame_width, frame_height) 
   
        # Below VideoWriter object will create 
        # a frame of above defined The output  
        # is stored in 'filename.avi' file. 
        # result = cv2.VideoWriter(save_path,  
        #                  cv2.VideoWriter_fourcc(*'mp4v'), 
        #                  60, size)
        result = cv2.VideoWriter(save_path,  
                         cv2.VideoWriter_fourcc(*'MJPG'), 
                         60, size)

        for k in range(duration[0]):
            result.write(np.uint8(cross_img))
        for k in range(duration[1]):
            result.write(np.uint8(experiment_img))
        for k in range(duration[2]):
            result.write(np.uint8(mask_img))
        for k in range(duration[3]):
            result.write(np.uint8(white_img))
        
        result.release() 
    
        # Closes all the frames 
        cv2.destroyAllWindows() 
        
        
        video_data.append({"video":file_name+".mp4",
                           "image":experiment_image.split('/')[-1],
                           "label":correct_label,
                           "response_options":response_options,
                           "mask_type": mask_type,
                           "mask":mask_image.split('/')[-1],
                           "cross_duration":duration[0],
                           "image_duration":duration[1],
                           "mask_duration":duration[2],
                           "white_end_frames":duration[3]
                          })

        clip = moviepy.VideoFileClip(save_path)
        clip.write_videofile(os.path.join(experiment_dir, f'videos/' + file_name + '.mp4'), logger=None)
    return video_data


def get_duration_samples(frame_counts):
    # 60 frames (1 s)
    flash_duration = lambda num_frames: num_frames
    duration_samples = [(flash_duration(90), flash_duration(f), flash_duration(30), flash_duration(30)) for f in frame_counts]
    return duration_samples


def generate_videos(duration_samples, white_mask_loc, cross_image_loc, image_to_label, response_options, phase_mask_dir, stimuli_dir, experiment_dir):
    image_sets = [[os.path.join(cls, img) for img in os.listdir(os.path.join(stimuli_dir, cls))] for cls in os.listdir(stimuli_dir)]
    args = []
    video_data = []
    for i in range(len(image_sets)):
        for j, img in enumerate(image_sets[i]):
            suffix = img.split('.')[-1]
            mask_image_name = img[:img.rfind('.')] + '_phase_scramble.' + suffix
            mask = mask_image_name
            mask_type = "color_phase"

            mask = os.path.join(phase_mask_dir, mask)
            img = os.path.join(stimuli_dir, img)

            args.append((cross_image_loc, [img], (mask, mask_type), white_mask_loc, duration_samples, image_to_label, response_options, experiment_dir))
    

    pool = multiprocessing.Pool(multiprocessing.cpu_count())
    video_data = []
    for result in tqdm(pool.map(frames_to_videos, args), total=len(args)):
        video_data.extend(result)

    pool.close()

    return video_data


def make_and_save_videos(experiment_name, stimuli_dir, frame_counts):
    # set up experiment directory 
    owd = os.getcwd()
    experiment_dir = os.path.join(owd, f'{experiment_name}_data')
    mask_image_dir = os.path.join(owd, f'{experiment_name}_data/images/')
    if not os.path.exists(os.path.join(owd, f'{experiment_name}_data', 'videos')):
        os.makedirs(os.path.join(owd, f'{experiment_name}_data', 'videos'))
    

    # where the experiment stimuli images and corresponding masks are for embedding in video
    make_phase_masks(stimuli_dir)
    if stimuli_dir.endswith('/'):
        phase_mask_dir = stimuli_dir[:-1] + '_phase_scramble'
    else:
        phase_mask_dir = stimuli_dir + '_phase_scramble'


    os.chdir(owd)
    if not os.path.exists(mask_image_dir+"cross"):
        os.makedirs(mask_image_dir+"cross")


    # create fixation cross image
    img_size = (672, 672)
    cross = create_cross_image(img_size)
    cross_image_loc = os.path.join(mask_image_dir, "cross/cross.png")
    cross.save(cross_image_loc, "png")

    white_mask = create_white_mask_image(img_size)
    white_mask_loc = os.path.join(mask_image_dir, "white_mask.png")
    white_mask.save(white_mask_loc, "png")

    os.chdir(f"{experiment_name}_data")

    # get image to class mapping and response options
    class_info = get_classes(stimuli_dir)
    images_to_class = class_info['images_to_class']
    response_options = class_info['response_options']

    duration_samples = get_duration_samples(frame_counts)

    video_data = generate_videos(duration_samples, white_mask_loc, cross_image_loc, images_to_class, response_options, phase_mask_dir, stimuli_dir, experiment_dir)

    
    # dump video data into experiment directory for use in experiments
    with open(f'video_data_{experiment_name}.json', 'w') as f:
        json.dump(video_data,f)

if __name__ == "__main__":
    # TODO argument parser
    experiment_name = 'toy_folder'
    stimuli_dir = '/storage/jecummin/datasets/toy_image_folder'
    frame_counts = [1, 3, 6, 9, 15, 600]

    make_and_save_videos(experiment_name, stimuli_dir, frame_counts)
