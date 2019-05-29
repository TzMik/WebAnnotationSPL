const Toolset = require('../contentScript/Toolset')
const Screenshots = require('./Screenshots')
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

      let generatorImageURL = chrome.extension.getURL('/images/generator.png')
      this.generatorImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.generatorImage.src = generatorImageURL
      this.generatorImage.id = 'reviewGeneratorButton'
      this.generatorImage.title = 'Generate report'
      this.toolsetBody.appendChild(this.generatorImage)
      this.generatorImage.addEventListener('click', () => {
    	  this.generateReview()
      })
      
      let screenshotsImageURL = chrome.extension.getURL('/images/screenshot.png')
      this.screenshotsImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.screenshotsImage.src = screenshotsImageURL
      this.screenshotsImage.title = 'Take screenshots'
      this.toolsetBody.appendChild(this.screenshotsImage)
      this.screenshotsImage.addEventListener('click', () => {
    	  this.generateScreenshot()
      })

      // Set delete annotations image and event
      let deleteAnnotationsImageURL = chrome.extension.getURL('/images/deleteAnnotations.png')
      this.deleteAnnotationsImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.deleteAnnotationsImage.src = deleteAnnotationsImageURL
      this.deleteAnnotationsImage.title = 'Delete all annotations'
      this.toolsetBody.appendChild(this.deleteAnnotationsImage)
      this.deleteAnnotationsImage.addEventListener('click', () => {
        this.deleteAnnotations()
      })

      // Set create canvas image and event
      let overviewImageURL = chrome.extension.getURL('/images/overview.png')
      this.overviewImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.overviewImage.src = overviewImageURL
      this.overviewImage.title = 'Create canvas image'
      this.toolsetBody.appendChild(this.overviewImage)
      this.overviewImage.addEventListener('click', () => {
        this.generateCanvas()
      })

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

  generateScreenshot () {
    Screenshots.takeScreenshot()
  }

  generateReview () {
    Alerts.loadingAlert({text: chrome.i18n.getMessage('GeneratingReviewReport')})
    let allAnnotations = window.abwa.contentAnnotator.allAnnotations
    let t = 'TEXT REPORT \n\n'
    for (let i = 0, len = allAnnotations.length; i < len; i++) {
      /*
      let facetTag = _.find(allAnnotations[i].tags, (tag) => {
    	return tag.includes(Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.relation + ':')
      })
      if (facetTag) {
    	let facetName = facetTag.replace(Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.relation + ':', '')
        let facet = _.find(window.abwa.specific.mappingStudyManager.mappingStudy.facets, (facet) => { return facet.name === facetName })
        if (facet.multivalued || facet.monovalued) t += '(Validated) '
      } else {
    	let facetName = facetTag.replace(Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.statics.validated, '')
        let facet = _.find(window.abwa.specific.mappingStudyManager.mappingStudy.facets, (facet) => { return facet.name === facetName })
        if (facet) t += '(Validated) '
      }*/
      t += allAnnotations[i].tags[1].replace('slr:code:', '') + ': ' + allAnnotations[i].target[0].selector[3].exact + '\n\n'
    }
    let blob = new Blob([t], {type: 'text/plain;charset=utf-8'})
    let docTitle = 'Review report'
    FileSaver.saveAs(blob, docTitle+'.txt')
    Alerts.closeAlert()
  }

  deleteAnnotations () {
    // Ask user if they are sure to delete it
    Alerts.confirmAlert({
      alertType: Alerts.alertType.question,
      title: chrome.i18n.getMessage('DeleteAllAnnotationsConfirmationTitle'),
      text: chrome.i18n.getMessage('DeleteAllAnnotationsConfirmationMessage'),
      callback: (err, toDelete) => {
        // It is run only when the user confirms the dialog, so delete all the annotations
        if (err) {
          // Nothing to do
        } else {
          // Dispatch delete all annotations event
          LanguageUtils.dispatchCustomEvent(Events.deleteAllAnnotations)
          // TODO Check if it is better to maintain the sidebar opened or not
          window.abwa.sidebar.openSidebar()
        }
      }
    })
  }

  generateCanvas () {
    window.abwa.sidebar.closeSidebar()
    Alerts.loadingAlert({text: chrome.i18n.getMessage('GeneratingReviewReport')})
    let allAnnotations = window.abwa.contentAnnotator.allAnnotations
    let canvasPageURL = chrome.extension.getURL('pages/specific/reviewCanvas.html')
    axios.get(canvasPageURL).then((response) => {
      document.body.lastChild.insertAdjacentHTML('afterend', response.data)
      document.querySelector("#abwaSidebarButton").style.display = "none"

      let canvasContainer = document.querySelector("#canvasContainer")
      document.querySelector("#canvasOverlay").addEventListener("click",function(){
        document.querySelector("#reviewCanvas").parentNode.removeChild(document.querySelector("#reviewCanvas"))
        document.querySelector("#abwaSidebarButton").style.display = "block"
      })
      document.querySelector("#canvasContainer").addEventListener("click",function(e){
        e.stopPropagation()
      })
      document.addEventListener("keydown",function(e){
        if(e.keyCode==27&&document.querySelector("#reviewCanvas")!=null) document.querySelector("#reviewCanvas").parentNode.removeChild(document.querySelector("#reviewCanvas"))
        document.querySelector("#abwaSidebarButton").style.display = "block"
      })
      document.querySelector("#canvasCloseButton").addEventListener("click",function(){
        document.querySelector("#reviewCanvas").parentNode.removeChild(document.querySelector("#reviewCanvas"))
        document.querySelector("#abwaSidebarButton").style.display = "block"
      })

      let canvasClusters = {}
      let criteriaList = []
      abwa.tagManager.currentTags.forEach((e) => {
    	criteriaList.push(e.config.name)
    	if (canvasClusters[e.config.group] == null) canvasClusters[e.config.group] = [e.config.name]
    	else canvasClusters[e.config.group].push(e.config.name)
      })
      
      abwa.tagManager.currentTags.forEach((e) => {
    	let tags = []
    	e.tags.forEach((t) => {
    	 tags.push(t.name)
    	})
    	canvasClusters[e.config.name] = tags
      })
      
      let clusterTemplate = document.querySelector("#propertyClusterTemplate")
      let columnTemplate = document.querySelector("#clusterColumnTemplate")
      let propertyTemplate = document.querySelector("#clusterPropertyTemplate")
      let annotationTemplate = document.querySelector("#annotationTemplate")
      //let clusterHeight = 100.0/Object.keys(canvasClusters).length
      
      
      let displayAnnotation = (annotation) => {
        //let swalContent = '';
        //if(annotation.highlightText!=null&&annotation.highlightText!='') //swalContent += '<h2 style="text-align:left;margin-bottom:10px;">Highlight</h2><div style="text-align:justify;font-style:italic">"'+annotation.highlightText.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'"</div>'
        //if(annotation.comment!=null&&annotation.comment!='') //swalContent += '<h2 style="text-align:left;margin-top:10px;margin-bottom:10px;">Comment</h2><div style="text-align:justify;">'+annotation.comment.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'
        //if(annotation.suggestedLiterature!=null&&annotation.suggestedLiterature.length>0) //swalContent += '<h2 style="text-align:left;margin-top:10px;margin-bottom:10px;">Suggested literature</h2><div style="text-align:justify;"><ul style="padding-left:10px;">'+annotation.suggestedLiterature.map((e) => {return '<li>'+e.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</li>'}).join('')+'</ul></div>'
        /*swal({
          html: swalContent,
          confirmButtonText: "View in context"
        }).then((result) => {
          if(result.value){
            document.querySelector("#reviewCanvas").parentNode.removeChild(document.querySelector("#reviewCanvas"))
            window.abwa.contentAnnotator.goToAnnotation(window.abwa.contentAnnotator.allAnnotations.find((e) => {return e.id==annotation.id}))
            document.querySelector("#abwaSidebarButton").style.display = "block"
          }
        })*/
      }

    
      for (let i = 0, len = criteriaList.length; i < len; i++){
        let clusterElement = clusterTemplate.content.cloneNode(true)
        let percentage = 100 / criteriaList.length
        clusterElement.querySelector(".propertyCluster").style.height = percentage + '%'
        if (criteriaList[i].length > 11){
      	  clusterElement.querySelector(".clusterLabel span").innerText = criteriaList[i].substring(0,10) + '...'
        } else {
      	  clusterElement.querySelector(".clusterLabel span").innerText = criteriaList[i]
        }
        let clusterContainer = clusterElement.querySelector('.clusterContainer')
        let currentColumn = null
        for (let j = 0, len = canvasClusters[criteriaList[i]].length; j < len; j++) {
          currentColumn = columnTemplate.content.cloneNode(true)
      	  percentage = 100 / canvasClusters[criteriaList[i]].length
      	  currentColumn.querySelector('.clusterColumn').style.width = percentage + '%'
          let clusterProperty = propertyTemplate.content.cloneNode(true)
          clusterProperty.querySelector(".propertyLabel").innerText = canvasClusters[criteriaList[i]][j]
          let propertyHeight = 100 / canvasClusters.facet.length
          clusterProperty.querySelector(".clusterProperty").style.height = '100%'
          clusterProperty.querySelector(".clusterProperty").style.width = "100%";
          let criterionAnnotations = allAnnotations.filter((e) => {return e.tags[1].replace('slr:code:', '') === canvasClusters[criteriaList[i]][j]})
          if(criterionAnnotations.length == 0) clusterProperty.querySelector('.propertyAnnotations').style.display = 'none'
          	  
          let annotationWidth = 100.0/criterionAnnotations.length
          for(let k=0; k<criterionAnnotations.length; k++){
        	let annotationElement = annotationTemplate.content.cloneNode(true)
            annotationElement.querySelector('.canvasAnnotation').style.width = annotationWidth+'%'
            annotationElement.querySelector('.canvasAnnotation').innerText = '"'+criterionAnnotations[k].target[0].selector[3].exact+'"'
            annotationElement.querySelector('.canvasAnnotation').className += ' unsorted'
            clusterProperty.querySelector('.propertyAnnotations').appendChild(annotationElement)
          }
          currentColumn.querySelector('.clusterColumn').appendChild(clusterProperty)
          clusterContainer.appendChild(currentColumn)
        }
        canvasContainer.appendChild(clusterElement)
      }
      
      Alerts.closeAlert()
    })
  }

  resume (){
    if(window.abwa.contentAnnotator.allAnnotations.length>0) window.abwa.contentAnnotator.goToAnnotation(window.abwa.contentAnnotator.allAnnotations.reduce((max,a) => new Date(a.updated) > new Date(max.updated) ? a : max))
  }

  parseAnnotations (annotations){
    const criterionTag = Config.review.namespace + ':' + Config.review.tags.grouped.relation + ':'
    const levelTag = Config.review.namespace + ':' + Config.review.tags.grouped.subgroup + ':'
    const majorConcernLevel = 'Major weakness'
    const minorConcernLevel = 'Minor weakness'
    const strengthLevel = 'Strength'
    let r = new Review()

    for (let a in annotations) {
      let criterion = null
      let level = null
      for (let t in annotations[a].tags) {
        if (annotations[a].tags[t].indexOf(criterionTag) != -1) criterion = annotations[a].tags[t].replace(criterionTag, '').trim()
        if (annotations[a].tags[t].indexOf(levelTag) != -1) level = annotations[a].tags[t].replace(levelTag, '').trim()
      }
      //if (criterion == null || level == null) continue
      let textQuoteSelector = null
      let highlightText = '';
      let pageNumber = null
      for (let k in annotations[a].target) {
        if (annotations[a].target[k].selector.find((e) => { return e.type === 'TextQuoteSelector' }) != null) {
          textQuoteSelector = annotations[a].target[k].selector.find((e) => { return e.type === 'TextQuoteSelector' })
          highlightText = textQuoteSelector.exact
        }
        if (annotations[a].target[k].selector.find((e) => { return e.type === 'FragmentSelector'}) != null){
          pageNumber = annotations[a].target[k].selector.find((e) => { return e.type === 'FragmentSelector'}).page
        }
      }
      let annotationText = annotations[a].text!==null&&annotations[a].text!=='' ? JSON.parse(annotations[a].text) : {comment:'',suggestedLiterature:[]}
      let comment = annotationText.comment !== null ? annotationText.comment : null
      let suggestedLiterature = annotationText.suggestedLiterature !== null ? annotationText.suggestedLiterature : []
      r.insertAnnotation(new Annotation(annotations[a].id,criterion,level,highlightText,pageNumber,comment,suggestedLiterature))
    }
    return r
  }

  show () {
    super.show()
  }

  hide () {
    super.hide()
  }
}

module.exports = ToolsetBar