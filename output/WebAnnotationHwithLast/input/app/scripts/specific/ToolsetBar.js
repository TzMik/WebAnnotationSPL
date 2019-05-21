const Toolset = require('../contentScript/Toolset')
const BackLink = require('./BackLink')
const axios = require('axios')
const _ = require('lodash')
const Alerts = require('../utils/Alerts')
const LanguageUtils = require('../utils/LanguageUtils')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
const Config = require('../Config')
const FileSaver = require('file-saver')
const Events = require('../contentScript/Events')

//let swal = require('sweetalert2')

class ToolsetBar extends Toolset{
  init() {
    super.init(() => {
      // Change toolset header name
      this.toolsetHeader.innerText = 'Toolset'
      let toolsetButtonTemplate = document.querySelector('#toolsetButtonTemplate')

      



      // Set resume image and event
      let resumeImageURL = chrome.extension.getURL('/images/resume.png')
      this.resumeImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.resumeImage.src = resumeImageURL
      this.resumeImage.title = 'Go to last annotation'
      this.toolsetBody.appendChild(this.resumeImage)
      this.resumeImage.addEventListener('click', () => {
        this.resume()
      })

      // Set back link icon
      let imageUrl = chrome.extension.getURL('/images/spreadsheet.svg')
      this.image = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.image.src = imageUrl
      this.image.title = 'Back to spreadsheet' // TODO i18n
      this.toolsetBody.appendChild(this.image)
      window.abwa.specific.primaryStudySheetManager.retrievePrimaryStudyRow((err, primaryStudyRow) => {
        let rowInSheet
	    if (err || primaryStudyRow === 0) {
	      console.log('Error')
	      rowInSheet = 1
	    }
	    else {
	      rowInSheet = primaryStudyRow + 1 
	    }
	    let spreadsheetId = window.abwa.specific.mappingStudyManager.mappingStudy.spreadsheetId
        let sheetId = window.abwa.specific.mappingStudyManager.mappingStudy.sheetId
        // Construct link to spreadsheet
        this.linkToSLR = document.createElement('a')
        this.linkToSLR.href = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit#gid=' + sheetId + '&range=A' + rowInSheet
        //this.linkToSLR.innerText = 'Back to spreadsheet' // TODO i18n
        this.linkToSLR.target = '_blank'
        this.spreadsheetLink = this.linkToSLR
        this.spreadsheetLink.appendChild(this.image)
        this.toolsetBody.appendChild(this.spreadsheetLink)
	  },false)
    })
  }





  resume (){
    if(window.abwa.contentAnnotator.allAnnotations.length>0) window.abwa.contentAnnotator.goToAnnotation(window.abwa.contentAnnotator.allAnnotations.reduce((max,a) => new Date(a.updated) > new Date(max.updated) ? a : max))
  }


  show () {
    super.show()
  }

  hide () {
    super.hide()
  }
}

module.exports = ToolsetBar