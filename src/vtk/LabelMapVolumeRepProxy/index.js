import macro from 'vtk.js/Sources/macro';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkAbstractRepresentationProxy from 'vtk.js/Sources/Proxy/Core/AbstractRepresentationProxy';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';

import utils from 'paraview-glance/src/utils';

/* eslint-disable-next-line import/no-named-as-default-member */
const { makeSubManager } = utils;

// ----------------------------------------------------------------------------
// vtkLabelMapVolumeRepProxy methods
// ----------------------------------------------------------------------------

function vtkLabelMapVolumeRepProxy(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkLabelMapVolumeRepProxy');

  const labelMapSub = makeSubManager();

  // Volume
  model.mapper = vtkVolumeMapper.newInstance();
  model.volume = vtkVolume.newInstance();
  model.property = model.volume.getProperty();

  model.property.setInterpolationTypeToNearest();

  function updateTransferFunctions(labelmap) {
    const colorMap = labelmap.getColorMap();

    const cfun = vtkColorTransferFunction.newInstance();
    const ofun = vtkPiecewiseFunction.newInstance();

    Object.keys(colorMap).forEach((label) => {
      const l = Number(label);
      cfun.addRGBPoint(l, ...colorMap[label].slice(0, 3).map((c) => c / 255));
      ofun.addPoint(l, colorMap[label][3] / 255);
    });

    model.property.setRGBTransferFunction(0, cfun);
    model.property.setScalarOpacity(0, ofun);

    const maxDim = Math.max(
      ...labelmap.getImageRepresentation().getDimensions()
    );
    model.property.setScalarOpacityUnitDistance(0, Math.sqrt(maxDim));

    const sampleDistance = labelmap
      .getImageRepresentation()
      .getSpacing()
      .map((v) => v * v)
      .reduce((a, b) => a + b, 0);
    model.mapper.setSampleDistance(sampleDistance * 2 ** -1.5);
  }

  model.sourceDependencies.push({
    setInputData(labelmap) {
      if (labelmap) {
        labelMapSub.sub(
          labelmap.onModified(() => updateTransferFunctions(labelmap))
        );
        updateTransferFunctions(labelmap);
        model.mapper.setInputData(labelmap.getImageRepresentation());
      } else {
        // this probably will never happen
        labelMapSub.unsub();
      }
    },
  });

  // connect rendering pipeline
  model.volume.setMapper(model.mapper);
  model.volumes.push(model.volume);

  // API ----------------------------------------------------------------------

  publicAPI.setVisibility = (isVisible) => {
    model.volume.setVisibility(isVisible);
  };

  publicAPI.getVisibility = () => model.volume.getVisibility();

  publicAPI.isVisible = publicAPI.getVisibility;

  publicAPI.delete = macro.chain(publicAPI.delete, () => {
    labelMapSub.unsub();
  });
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Object methods
  vtkAbstractRepresentationProxy.extend(publicAPI, model);

  // Object specific methods
  vtkLabelMapVolumeRepProxy(publicAPI, model);
  macro.proxyPropertyMapping(publicAPI, model, {
    volumeVisibility: { modelKey: 'volume', property: 'visibility' },
  });
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkLabelMapVolumeRepProxy'
);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
