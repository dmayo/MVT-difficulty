import os
import argparse
from generate_videos import make_and_save_videos
from generate_experiment_sets import make_video_lists_and_link_csv



if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument('image_directory', help='Directory containing experiment images')
    parser.add_argument('--experiment_name', help='Experiment name',  default='experiment')
    parser.add_argument('--frame_counts', help='List of frame counts for image presentation times. 1 frame is 1/60s', nargs='*', type=int, default=[1, 3, 6, 9, 15, 600])
    parser.add_argument('--num_images_per_task', help='The number of images to show in each MTurk task', type=int, default=50)
    parser.add_argument('--num_workers', help='The number of workers who will see an image at each duration', type=int, default=7)

    owd = os.getcwd()
    args = parser.parse_args()

    environment = os.environ
    for var in [
            "EXPERIMENT_HOST",
            "EXPERIMENT_PORT",
            "REDIS_HOST",
            "REDIS_PORT",
            "REDIS_DB",
            "REDIS_PASSWORD"
    ]:
        assert var in environment ; f"Environment variable {var} is not set"

    # make videos from each image with each duration
    make_and_save_videos(args.experiment_name, args.image_directory, args.frame_counts)

    os.chdir(owd)

    os.system(f'export NUM_IMAGES_PER_TASK={args.num_images_per_task}')
    os.system(f'export NUM_VIDEO_LISTS_PER_LINK={args.num_workers * len(args.frame_counts)}')
    # make experiment sets and links from videos
    make_video_lists_and_link_csv(args.experiment_name, args.image_directory, args.num_images_per_task, args.num_workers)
    
    
    if os.path.exists('./experiment/public/experiment_data'):
        confirmed = False
        response = input('Directory ./experiment/public/experiment_data exists. Overwrite? (y/n)')
        while not confirmed:
            if response.lower() in ['y', 'yes']:
                confirmed = True
            elif response.lower() in ['n', 'no']:
                print('Save ./experiment/public/experiment_data under a different name and run again.')
                quit()
            else:
                response = input('Please answer with (y/n)')


    # todo generate videos
    # todo generate experiment sets
    # todo moves files to public/experiment_data


    os.system(f'rm -rf ./experiment/public/experiment_data')
    os.system(f'mv {args.experiment_name}_data ./experiment/public/experiment_data')
