import { createAction } from 'redux-actions';
import * as types from '../constants/ActionTypes';
import utils from '../../utils';

export const newWorkspace = createAction(types.LOAD_WORKSPACE, (audioCtx)=>{
  return fetch(`/workspace/create`, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'post',
    credentials: 'same-origin',
  })
  .then((response) => {
    return response.json();
  })
  .then((data) => {
    return Promise.all(data.workspace.rows.map((row) => {
      return fetch(row.rawAudio);
    }))
    .then((files) => {
      return Promise.all(files.map((file) => {
        return file.arrayBuffer();
      }))
      .then((arrayBuffers) => {
        return Promise.all(arrayBuffers.map((arrayBuffer) => {
          return audioCtx.decodeAudioData(arrayBuffer);
        }))
        .then((buffers) => {
          let rows = utils.modelToState(data.workspace);
          rows = Array.prototype.map.call(rows, (row, i) => {
            row.rawAudio = buffers[i];
            return row;
          });
          return {id: data.workspace.id, rows: rows}; 
        });
      });
    });
  })
  .catch(err =>{
    console.log(err);
  });
});

export const loadWorkspace = createAction(types.LOAD_WORKSPACE, (workspaceId, audioCtx) => {
  return fetch(`/workspace/load`, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'post',
    credentials: 'same-origin',
    body: JSON.stringify({'id': workspaceId})
  })
  .then((response) => {
    return response.json();
  })
  .then((data) => {
    return Promise.all(data.workspace.rows.map((row) => {
      return fetch(row.rawAudio);
    }))
    .then((files) => {
      return Promise.all(files.map((file) => {
        return file.arrayBuffer();
      }))
      .then((arrayBuffers) => {
        return Promise.all(arrayBuffers.map((arrayBuffer) => {
          return audioCtx.decodeAudioData(arrayBuffer);
        }))
        .then((buffers) => {
          let rows = utils.modelToState(data.workspace);
          rows = Array.prototype.map.call(rows, (row, i) => {
            row.rawAudio = buffers[i];
            return row;
          });
          return {id: data.workspace.id, rows: rows}; 
        });
      });
    });
  })
  .catch(err =>{
    console.log(err);
  });
});

export const setPlayingMode = createAction(types.SET_PLAYING_MODE, (mode) => {
  return mode;
});

export const setSeeker = createAction(types.SET_SEEKER, (seeker) => {
  return seeker;
});

export const setZoom = createAction(types.SET_ZOOM, (zoom) => {
  return zoom;
});

export const stopPlaying = createAction(types.STOP_PLAYING, (stop) => {
  return stop;
});

export const setCursor = createAction(types.SET_CURSOR, (cursor) => {
  return cursor;
});

export const setSpeed = createAction(types.SET_SPEED, (speed) => {
  return speed;
});

export const addRow = createAction(types.ADD_ROW, (addOperation, audioCtx) => {
  // TODO: Make a request to download the file at filename served statically, decode it, add to newRow object, return that
  // Not sure if this works
  return fetch(addOperation.newRow.rawAudio)
  .then((file) => {
    return file.arrayBuffer();
  })
  .then((arrayBuffer) => {
    return audioCtx.decodeAudioData(arrayBuffer)
  })
  .then((buffer) => {
    addOperation.newRow.rawAudio = buffer;
    return addOperation.newRow;
  })
  .catch(err => {
    console.log(err);
  });
});

export const removeRow = createAction(types.REMOVE_ROW, (rowId) => {
  return rowId;
});

export const flagBlock = createAction(types.FLAG_TRACK, (newFlags) => {
  return newFlags;
});

export const splitBlock = createAction(types.SPLIT_BLOCK, (newBlocks) => {
  return newBlocks;
});

export const moveBlock = createAction(types.MOVE_BLOCK, (newBlocks) => {
  return newBlocks;
});

