import sys
sys.path.insert(0, '/home/forrestli/ITK/build/Wrapping/Generators/Python')
sys.path.insert(1, '/home/forrestli/ITK/build/lib')
sys.path.insert(2, '/home/forrestli/ITKTubeTK/build2/lib')

import itk
import random

from helper2 import Api, rpc

class SegmentApi(Api):
    def __init__(self):
        super().__init__()
        self.segmenter = None
        self.input_image = None
        self.next_tube_id = 0
        self.tube_id_mapping = {}

    @rpc('preprocess')
    def preprocess(self, image, filters):
        filters = {f['filter']:f for f in filters}

        OldImageType = type(image)
        ImageType = itk.Image[itk.F, 3]
        image = itk.CastImageFilter[OldImageType, itk.Image[itk.F, 3]].New()(image)

        result = image
        if 'windowLevel' in filters:
            args = filters['windowLevel']
            wl_filter = itk.IntensityWindowingImageFilter[ImageType, ImageType].New()
            wl_filter.SetInput(image)
            wl_filter.SetWindowLevel(args['width'], args['level'])
            wl_filter.SetOutputMinimum(0)
            wl_filter.SetOutputMaximum(1024)
            wl_filter.Update()
            result = wl_filter.GetOutput()

        if 'median' in filters:
            args = filters['median']
            median_filter = itk.MedianImageFilter[ImageType, ImageType].New()
            median_filter.SetInput(image)
            median_filter.SetRadius(args['radius'])
            median_filter.Update()
            result = median_filter.GetOutput()

        result = itk.CastImageFilter[ImageType, OldImageType].New()(result)

        self.persist(result)
        return result

    @rpc('set_segment_image')
    def set_segment_image(self, image):
        if image != self.input_image:
            self.input_image = image
            self.segmenter = itk.TubeTK.SegmentTubes[type(image)].New()
            self.segmenter.SetInputImage(image)

    @rpc('segment')
    def segment(self, position, scale):
        if self.segmenter is None:
            raise Exception('segment image is not set')

        tube = self.segmenter.ExtractTube(position, self.next_tube_id, True)
        if tube is not None:
            self.segmenter.AddTube(tube)
            self.tube_id_mapping[tube.GetId()] = tube
            self.next_tube_id += 1
            return tube

    @rpc('delete_tubes')
    def delete_tubes(self, tube_ids):
        if self.segmenter is None:
            raise Exception('segment image is not set')

        for id_ in tube_ids:
            tube = self.tube_id_mapping[id_]
            self.segmenter.DeleteTube(tube)
            del self.tube_id_mapping[id_]
