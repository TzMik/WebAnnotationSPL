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
      this.mode = ModeManager.modes.index
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
  loadSidebarToggle (callback) {
    let sidebarURL = chrome.extension.getURL('pages/sidebar/annotatorMode.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('#abwaSidebarContainer').append($.parseHTML(html))
      // Set toggle status
      this.setToggleStatus()
      // Set tags text
      this.setPanelText()
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  setToggleStatus () {
    if (this.mode === ModeManager.modes.evidencing) {
      this.setEvidencingMode()
    } else {
      this.setIndexMode()
    }
  }
  setPanelText () {
    // Mode element
    let modeHeaderLabel = document.querySelector('#modeHeader label')
    modeHeaderLabel.innerText = chrome.i18n.getMessage('Mode')
    let modeLabel = document.querySelector('#modeLabel')
    if (this.mode === ModeManager.modes.highlight) {
      modeLabel.innerText = chrome.i18n.getMessage('Evidencing')
    } else {
      modeLabel.innerText = chrome.i18n.getMessage('index')
    }
  }


  setEvidencingMode () {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    let modeLabel = document.querySelector('#modeLabel')
    annotatorToggle.checked = false
    modeLabel.innerText = chrome.i18n.getMessage('Evidencing')
    this.mode = ModeManager.modes.evidencing
  }

  setIndexMode () {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    let modeLabel = document.querySelector('#modeLabel')
    annotatorToggle.checked = true
    modeLabel.innerText = chrome.i18n.getMessage('index')
    this.mode = ModeManager.modes.index
  }



  initEventHandlers (callback) {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    annotatorToggle.addEventListener('click', (event) => {
      if (annotatorToggle.checked) {
    	this.setIndexMode()
      } else {
    	this.setEvidencingMode()
      }
      LanguageUtils.dispatchCustomEvent(Events.modeChanged, {mode: this.mode})
    })
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

ModeManager.modes = {
  'evidencing': 'evidencing',
  'index': 'index'
}

module.exports = ModeManager