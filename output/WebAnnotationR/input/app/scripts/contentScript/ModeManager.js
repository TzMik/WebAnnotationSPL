const $ = require('jquery')
const _ = require('lodash')
const LanguageUtils = require('../utils/LanguageUtils')
const Events = require('./Events')

class ModeManager {
  constructor (mode) {
    if (mode) {
      this.mode = mode
    }
  }

  init (callback) {
    if (window.abwa.annotationBasedInitializer.initAnnotation) {
      // Open sidebar
      window.abwa.sidebar.openSidebar()
    } else {
      this.mode = ModeManager.modes.evidencing
    }
    this.loadSidebarToggle(() => {
      this.initEventHandlers(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    })
  }
  setPanelText () {
    // Mode element
    let modeHeaderLabel = document.querySelector('#modeHeader label')
    modeHeaderLabel.innerText = chrome.i18n.getMessage('Mode')
    let modeLabel = document.querySelector('#modeLabel')
  }


  setEvidencingMode () {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    let modeLabel = document.querySelector('#modeLabel')
    annotatorToggle.checked = false
    modeLabel.innerText = chrome.i18n.getMessage('Evidencing')
    this.mode = ModeManager.modes.evidencing
  }




}

ModeManager.modes = {
  'evidencing': 'evidencing',
}

module.exports = ModeManager