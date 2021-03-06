import macro from 'vtk.js/Sources/macro';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
// import vtkSliceRepresentationProxy from 'vtk.js/Sources/Proxy/Core/SliceRepresentationProxy';
import vtkSliceRepresentationProxy from 'vtk.js/Sources/Proxy/Representations/SliceRepresentationProxy';
import ImagePropertyConstants from 'vtk.js/Sources/Rendering/Core/ImageProperty/Constants';

import utils from 'paraview-glance/src/utils';

/* eslint-disable-next-line import/no-named-as-default-member */
const { makeSubManager } = utils;
const { InterpolationType } = ImagePropertyConstants;

// ----------------------------------------------------------------------------
// vtkLabelMapSliceRepProxy methods
// ----------------------------------------------------------------------------

function vtkLabelMapSliceRepProxy(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkLabelMapSliceRepProxy');

  const labelMapSub = makeSubManager();

  model.property.setInterpolationType(InterpolationType.NEAREST);

  function updateTransferFunctions(labelmap) {
    const colorMap = labelmap.getColorMap();

    const cfun = vtkColorTransferFunction.newInstance();
    const ofun = vtkPiecewiseFunction.newInstance();

    Object.keys(colorMap).forEach((label) => {
      const l = Number(label);
      cfun.addRGBPoint(l, ...colorMap[label].slice(0, 3).map((c) => c / 255));
      ofun.addPoint(l, colorMap[label][3] / 255);
    });

    model.property.setRGBTransferFunction(cfun);
    model.property.setScalarOpacity(ofun);
  }

  function setInputData(labelmap) {
    labelMapSub.sub(
      labelmap.onModified(() => updateTransferFunctions(labelmap))
    );
    updateTransferFunctions(labelmap);
  }

  // override to return the image representation as the input dataset
  publicAPI.getInputDataSet = () =>
    model.input ? model.input.getDataset().getImageRepresentation() : null;

  // override because we manage our own color/opacity transfer functions
  publicAPI.setColorBy = () => {};

  publicAPI.delete = macro.chain(publicAPI.delete, () => labelMapSub.unsub());

  model.sourceDependencies = model.sourceDependencies.map((dep) => ({
    setInputData: (labelMap) =>
      dep.setInputData(labelMap.getImageRepresentation()),
  }));

  // Keep things updated
  model.sourceDependencies.push({ setInputData });
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Object methods
  vtkSliceRepresentationProxy.extend(publicAPI, model);

  // Object specific methods
  vtkLabelMapSliceRepProxy(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkLabelMapSliceRepProxy'
);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
