import React, { Component } from 'react';
import { playingMode } from '../../../utils.js';

import styles from './Tools.scss';

class Tools extends Component{
  constructor(props) {
    super(props);

    this.setPlayingMode = this.setPlayingMode.bind(this);
    this.zoomIn = this.zoomIn.bind(this);
    this.zoomOut = this.zoomOut.bind(this);
    this.stopPlaying = this.stopPlaying.bind(this);
  }

  setPlayingMode() {
    if( this.props.playing === playingMode.PLAYING ){
      this.props.setPlayingMode(playingMode.PAUSE);
    } else {
      this.props.setPlayingMode(playingMode.PLAYING);
    }
  }

  stopPlaying(){
    this.props.stopPlaying();
    this.props.setSeeker(this.props.cursor); // Change this to cursor position
  }

  zoomIn() {
    if (this.props.playing !== playingMode.PLAYING) {
      this.props.setZoom(this.props.currentZoom/2);
    }
  }

  zoomOut() {
    if (this.props.playing !== playingMode.PLAYING) {
      this.props.setZoom(this.props.currentZoom*2);
    }
  }

  render() {
    return (
      <div className = {styles.tools} >
        <input type='button' 
          value={this.props.playing === playingMode.PLAYING ? 'Pause' : 'Play'} 
          className={styles.pauseplay} 
          onClick={this.setPlayingMode}/>
        <input type='button' value='Stop' className={styles.stop}
          onClick={this.stopPlaying} />
        <input type='button' value='Cut' className={styles.cut} />
        <input type='button' value='Move' className={styles.move} />
        <input type='button' value='Split' className={styles.split} />
        <input type='button' value='Zoom In' onClick={this.zoomIn} />
        <input type='button' value='Zoom Out' onClick={this.zoomOut} />
      </div>
    )
  }
}

export default Tools;
