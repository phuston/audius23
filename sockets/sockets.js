var socketIO = require('socket.io');
var Workspace = require('../models/workspace');
var ObjectId = require('mongoose').Types.ObjectId;

var socketObject = {
  socketServer: function (server) {
    var io = socketIO.listen(server);

    io.sockets.on('connection', function(socket) {

      socket.on('connectWorkspace', function(username, hashcode){
        // TODO: Perform some sort of validation to ensure that workspace exists
        // Store username in socket session for this client
        socket.username = username;
        // Store room name in socket session for this client
        socket.workspaceId = hashcode;
        // Send client to workspace at hashcode
        socket.join(hashcode);
        // TODO: What do we need to emit to let the other users know to add a new user?
      });

      // Delete a block from a row
      socket.on('removeBlocks', function(operation) {
        Workspace.findOne({id: socket.workspaceId}, function(err, workspace) {
          if (err) return console.error(err);

          var newRows = workspace.rows;
          var thisRow, thisBlock;
          var newBlocks;

          for (var i=0; i<newRows.length; i++) {
            thisRow = newRows[i];
            newBlocks = [];
            for (var j=0; j<thisRow.audioBlocks.length; j++) {
              thisBlock = thisRow.audioBlocks[j];
              if (operation[thisRow._id.toString()].indexOf(thisBlock._id.toString()) === -1) {
                newBlocks.push(thisBlock);
              }
            }
            newRows[i].audioBlocks = newBlocks;
          }

          Workspace.findByIdAndUpdate(
            workspace._id,
            {$set: {rows: newRows}},
            {$safe: true, upsert: false, new: true},
            function(err, newWorkspace) {
              if (err) return console.error(err);

              var response = {}
              newWorkspace.rows.map(function(row) {
                response[row.rowId] = row.audioBlocks;
              });

              // Emit socket event to notify all clients to update state
              io.sockets.in(socket.workspaceId).emit('applyRemoveBlocks', {
                response: response
              });
            }
          );
        });
      });

      // Join multiple blocks back into one block. Keep fade in of first element and fade out of last element
      socket.on('spliceBlocks', function(spliceOperation) {
        Workspace.findOne({id: socket.workspaceId}, function(err, workspace){
          if (err) return console.error(err);

          var newRows = workspace.rows;

          // Find correct row to update
          var updateRow = workspace.rows.filter(function (row){ 
            return row._id == spliceOperation.rowId;
          })[0];

          var joinedBlock, index;

          // Store unaltered blocks in a new array so later can use $set instead of nested $push
          newBlocks = updateRow.audioBlocks.filter(function(block, i) {
            if (block._id.toString() === spliceOperation.joinedBlock) {
              joinedBlock = block;
              index = i;
              return false;
            } else {
              return spliceOperation.blocksToRemove.indexOf(block._id.toString()) === -1;
            }
          });

          // Reinsert the newly joined block
          joinedBlock.file_end = spliceOperation.newFileEnd;
          newBlocks.splice(index, 0, joinedBlock);

          // Update the correct row
          updateRow.audioBlocks = newBlocks;
          newRows[updateRow.rowId] = updateRow;

          // Updates DB state document
          Workspace.findByIdAndUpdate(
            workspace._id,
            {$set: {rows: newRows}},
            {safe: true, upsert: false, new: true},
            function(err, newWorkspace) {
              if (err) return console.error(err);

              // Emit socket event to notify all clients to update state
              io.sockets.in(socket.workspaceId).emit('applySpliceBlocks', {
                rowId: updateRow.rowId,
                newBlocks: newWorkspace.rows[updateRow.rowId].audioBlocks
              });
            }
          );
        });
      });

      // Split one block into two. Move fade out element (if any) to the right block.
      socket.on('splitBlock', function(splitOperation) {
        Workspace.findOne({id: socket.workspaceId}, function(err, workspace){
          if (err) return console.error(err);

          var newRows = workspace.rows;

          // Find correct row to update
          var updateRow = workspace.rows.filter(function (row){ 
            return row._id == splitOperation.rowId 
          })[0];

          var leftBlock, index, newBlocks;
          var splitAt = splitOperation.operation.splitElement;

          // Store unaltered blocks in a new array so later can use $set instead of nested $push
          newBlocks = updateRow.audioBlocks.filter(function(block, i) {
            if (block._id == splitOperation.blockId) {
              leftBlock = block;
              index = i;
              return false;
            }
            return true;
          });

          var fadeOutElement;

          leftBlock.flags = leftBlock.flags.filter(function(flag, i) {
            if (flag.type === 1) {
              fadeOutElement = flag;
              return false;
            }

            return true;
          });

          // Share and compute attributes of old block into the two new left and right blocks
          var oldEnd = leftBlock.file_end;
          leftBlock.file_end = (splitAt % 2 === 0) ? splitAt : splitAt+1;

          var lengthOfBlock = (leftBlock.file_end - leftBlock.file_offset) / 2;
          var rightBlock = {
            row_offset: leftBlock.row_offset + lengthOfBlock,
            file_offset: leftBlock.file_end,
            file_end: oldEnd,
            flags: [],
            _id: new ObjectId()
          };

          if (fadeOutElement) {
            fadeOutElement.start -= rightBlock.row_offset;
            fadeOutElement.end -= rightBlock.row_offset;
            rightBlock.flags.push(fadeOutElement);
          }

          // Add left and right blocks back. Must maintain order or else front-end  waveform generation will not work
          newBlocks.splice(index, 0, leftBlock);
          newBlocks.push(rightBlock);

          updateRow.audioBlocks = newBlocks;
          newRows[updateRow.rowId] = updateRow;

          // Updates DB state document
          Workspace.findByIdAndUpdate(
            workspace._id,
            {$set: {rows: newRows}},
            {safe: true, upsert: false, new: true},
            function(err, newWorkspace) {
              if (err) return console.error(err);

              // Emit socket event to notify all clients to update state
              io.sockets.in(socket.workspaceId).emit('applySplitBlock', {
                rowId: updateRow.rowId,
                newBlocks: newWorkspace.rows[updateRow.rowId].audioBlocks
              });
            }
          );
        });
      });

      // Drag a block around
      socket.on('moveBlock', function(moveOperation){
        Workspace.findOne({id: socket.workspaceId}, function(err, workspace){
          if (err) return console.error(err);

          var newRows = workspace.rows;

          // Find correct row to update
          var updateRow = workspace.rows.filter(function(row){
            return row._id == moveOperation.rowId;
          })[0];

          var movedBlock, newBlocks, index;

          // Find correct audioBlock to update
          var newBlocks = updateRow.audioBlocks.filter(function (block, i) {
            if (block._id == moveOperation.blockId) {
              movedBlock = block;
              index = i;
              return false;
            }
            return true;
          });

          // Apply delta to block
          movedBlock.row_offset = Math.max(movedBlock.row_offset + moveOperation.operation.moveShift, 0);
          // Put block back in place
          newBlocks.splice(index, 0, movedBlock);
          // Set updated audio blocks
          updateRow.audioBlocks = newBlocks;
          // Set that row
          newRows[updateRow.rowId] = updateRow;

          Workspace.findByIdAndUpdate(
            workspace._id,
            {$set: {rows: newRows}},
            {$safe: true, upsert: false, new: true},
            function(err, newWorkspace) {
              if (err) return console.error(err);
              
              // Emit socket event to notify all clients to update state
              io.sockets.in(socket.workspaceId).emit('applyMoveBlock', {
                rowId: updateRow.rowId,
                newBlocks: newWorkspace.rows[updateRow.rowId].audioBlocks
              });
            }
          );
        })
      });

      // Append a row to the workspace (called after file upload)
      socket.on('addRow', function(addOperation){
        Workspace.findOne({id: socket.workspaceId}, function(err, workspace){
          if (err) return console.error(err);

          var newRow;

          for (var i = 0; i < workspace.rows.length; i++) {
            if(workspace.rows[i]._id == addOperation.rowId) {
              newRow = workspace.rows[i];
              newRow.rowId = i;
            }
          }

          io.sockets.in(socket.workspaceId).emit('applyAddRow', {newRow: newRow});
        });
      });

      // Delete a row from the workspace
      socket.on('removeRow', function(removeOperation){
        Workspace.findOne({id: socket.workspaceId}, function(err, workspace){
          if (err) return console.error(err);

          // Filter out the deleted row
          var newRows = workspace.rows.filter(function(row) {
            return row._id.toString() !== removeOperation.rowId;
          });

          // Update their rowId attribute to the correct index for front-end rendering purposes
          if (newRows.length > 0) {
            newRows = newRows.map(function(row, i) {
              row.rowId = i;
              return row;
            });
          }

          Workspace.findByIdAndUpdate(
            workspace._id,
            {$set: {rows: newRows}},
            {$safe: true, upsert: false, new: true},
            function(err, newWorkspace) {
              if (err) return console.error(err);

              // Emit socket event to notify all clients to update state
              io.sockets.in(socket.workspaceId).emit('applyRemoveRow', {deletedRowId: removeOperation.rowId});
            }
          );
        });
      });

      // Change master volume of a given row
      socket.on('changeRowGain', function(gainOperation) {
        Workspace.findOne({id: socket.workspaceId}, function(err, workspace) {
          if (err) return console.error(err);

          var changedRow, index,
          newRows = workspace.rows.filter(function(row, i) {
            if (row._id.toString() === gainOperation.rowId) {
              changedRow = row;
              index = i;
              return false;
            }

            return true;
          });

          changedRow.gain = gainOperation.gain;
          newRows.splice(index, 0, changedRow);

          Workspace.findByIdAndUpdate(
            workspace._id,
            {$set: {rows: newRows}},
            {$safe: true, upsert: false, new: true},
            function(err, newWorkspace) {
              if (err) return console.error(err);

              io.sockets.in(socket.workspaceId).emit('applySetGain', {
                rowId: index,
                gain: gainOperation.gain
              });
            }
          );
        })
      });

      // Add a fade in flag for a block
      socket.on('setFadeIn', function(fadeInOperation) {
        Workspace.findOne({id: socket.workspaceId}, function(err, workspace) {
          if (err) return console.error(err);

          var changedRow, rowIndex, changedBlock, blockIndex, flagIndex
          newRows = workspace.rows.map(function(row, i) {
            if (row._id.toString() === fadeInOperation.rowId) {
              changedRow = row;
              rowIndex = i;
            }
            return row;
          }),
          newBlocks = changedRow.audioBlocks.map(function(block, i) {
            if (block._id.toString() === fadeInOperation.blockId) {
              changedBlock = block;
              blockIndex = i;
            }
            return block;
          }),
          fadeElement = {
            start: 0,
            end: fadeInOperation.end,
            type: 0,
            duration: fadeInOperation.duration,
          };

          changedBlock.flags.map(function(flag, i) {
            if (flag.type === 0) {
              flagIndex = i;
            }
          });

          if (flagIndex) {
            changedBlock.flags[flagIndex] = fadeElement;
          } else {
            changedBlock.flags.push(fadeElement);
          }

          newRows[rowIndex].audioBlocks[blockIndex] = changedBlock;

          Workspace.findByIdAndUpdate(
            workspace._id,
            {$set: {rows: newRows}},
            {$safe: true, upsert: false, new: true},
            function(err, newWorkspace) {
              if (err) return console.error(err);

              io.sockets.in(socket.workspaceId).emit('applyFade', {
                rowId: rowIndex,
                newBlocks: newWorkspace.rows[rowIndex].audioBlocks
              });
            }
          );
        });
      });

      // Add a fade out flag for a block
      socket.on('setFadeOut', function(fadeOutOperation) {
        Workspace.findOne({id: socket.workspaceId}, function(err, workspace) {
          if (err) return console.error(err);

          var changedRow, rowIndex, changedBlock, blockIndex, flagIndex
          newRows = workspace.rows.map(function(row, i) {
            if (row._id.toString() === fadeOutOperation.rowId) {
              changedRow = row;
              rowIndex = i;
            }
            return row;
          }),
          newBlocks = changedRow.audioBlocks.map(function(block, i) {
            if (block._id.toString() === fadeOutOperation.blockId) {
              changedBlock = block;
              blockIndex = i;
            }
            return block;
          }),
          fadeElement = {
            start: fadeOutOperation.start,
            end: fadeOutOperation.end,
            type: 1,
            duration: fadeOutOperation.duration,
          };

          changedBlock.flags.map(function(flag, i) {
            if (flag.type === 1) {
              flagIndex = i;
            }
          });

          if (flagIndex) {
            changedBlock.flags[flagIndex] = fadeElement;
          } else {
            changedBlock.flags.push(fadeElement);
          }

          newRows[rowIndex].audioBlocks[blockIndex] = changedBlock;

          Workspace.findByIdAndUpdate(
            workspace._id,
            {$set: {rows: newRows}},
            {$safe: true, upsert: false, new: true},
            function(err, newWorkspace) {
              if (err) return console.error(err);

              io.sockets.in(socket.workspaceId).emit('applyFade', {
                rowId: rowIndex,
                newBlocks: newWorkspace.rows[rowIndex].audioBlocks
              });
            }
          );
        });
      });

    });
  },
}

module.exports = socketObject;
