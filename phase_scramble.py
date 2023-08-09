import os
from PIL import Image
import numpy as np
from skimage.util import img_as_ubyte

import numpy as np
from scipy.fft import fft2, ifft2

def phaseScrambleImage(inputImage):
    inFourier = fft2(inputImage)
    inAmp = np.abs(inFourier)

    outPhase = np.angle(fft2(np.random.randn(*inputImage.shape)))

    scrambledImage = np.real(ifft2(inAmp * np.exp(1j * outPhase)))
    rescaled_scrambledImage = (scrambledImage - scrambledImage.min()) / (scrambledImage.max() - scrambledImage.min())
    return rescaled_scrambledImage

def make_phase_masks(image_folder):
    folder_name = image_folder.strip('/').split('/')[-1]
    outfold = f"{folder_name}_phase_scramble"
    cats = os.listdir(image_folder)

    for i in range(len(cats)):
        catname = cats[i]
        imgs = os.listdir(os.path.join(image_folder, catname))
        os.makedirs(os.path.join(outfold, catname), exist_ok=True)
    
        for j in range(len(imgs)):
            imname = imgs[j]
            im = np.array(Image.open(os.path.join(image_folder, catname, imname)).convert('RGB')) / 255

            if im.shape[2] == 3:
                imR = im[:,:,0]
                imG = im[:,:,1]
                imB = im[:,:,2]
                maskR = phaseScrambleImage(imR)
                maskG = phaseScrambleImage(imG)
                maskB = phaseScrambleImage(imB)
                mask = np.dstack((maskR, maskG, maskB))
            else:
                mask = phaseScrambleImage(im)

            # mask = img_as_ubyte(mask)
            imname_without_extension = os.path.splitext(imname)[0]
            extension = os.path.splitext(imname)[-1]
            output_name = imname_without_extension + "_phase_scramble" + extension
            output_path = os.path.join(outfold, catname, output_name)
            Image.fromarray((mask * 255).astype(np.uint8)).save(output_path)
