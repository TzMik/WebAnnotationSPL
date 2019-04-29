const Toolset = require('../contentScript/Toolset')
//
const Screenshots = require('./Screenshots')
//
//
const BackLink = require('./BackLink')
//
const axios = require('axios')
const _ = require('lodash')
//const Alerts = require('../utils/Alerts')
const LanguageUtils = require('../utils/LanguageUtils')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
//
const Config = require('../Config')
const FileSaver = require('file-saver')
const Events = require('../contentScript/Events')
//

//let swal = require('sweetalert2')

class ToolsetBar extends Toolset{
  init() {
    super.init(() => {
      // Change toolset header name
      this.toolsetHeader.innerText = 'Toolset'
      let toolsetButtonTemplate = document.querySelector('#toolsetButtonTemplate')

      //
      
    //
      let screenshotsImageURL = chrome.extension.getURL('/images/screenshot.png')
      this.screenshotsImageURL = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.screenshotsImageURL.src = generatorImageURL
      this.screenshotsImageURL.title = 'Take screenshots'
      this.toolsetBody.appendChild(this.generatorImage)
      this.screenshotsImageURL.addEventListener('click', () => {
    	  this.generateScreenshot()
      })
      //

      //

      //

      //

      //
      // Set back link icon
      //
      let imageUrl = chrome.extension.getURL('/images/moodle.svg')
      //
      this.image = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.image.src = imageUrl
      //
      this.image.title = 'Back to moodle' // TODO i18n
      //
      this.toolsetBody.appendChild(this.image)
      //
      BackLink.createWorkspaceLink().then((link) => {
        this.moodleLink = link
        this.moodleLink.appendChild(this.image)
        this.toolsetBody.appendChild(this.moodleLink)
      })
      //
      //
    })
  }

/*  //
  generateReviewButtonHandler () {
    // Create context menu
    $.contextMenu({
      selector: '#reviewGeneratorButton',
      trigger: 'left',
      build: () => {
        // Create items for context menu
        let items = {}
        //
        //
        items['screenshot'] = {name: 'Generate annotated PDF'}
        //
        return {
          callback: (key, opt) => {
            if (key === 'report') {
              //
            } else if (key === 'screenshot') {
              //
              this.generateScreenshot()
              //
            }
          },
          items: items
        }
      }
    })
  }
  //*/

  //
  generateScreenshot () {
    Screenshots.takeScreenshot()
  }
  //

  //

  //

  //

  //

  //

  show () {
    super.show()
  }

  hide () {
    super.hide()
  }
}

module.exports = ToolsetBar