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

      


      // Set create canvas image and event
      let overviewImageURL = chrome.extension.getURL('/images/overview.png')
      this.overviewImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.overviewImage.src = overviewImageURL
      this.overviewImage.title = 'Create canvas image'
      this.toolsetBody.appendChild(this.overviewImage)
      this.overviewImage.addEventListener('click', () => {
        this.generateCanvas()
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
      /*abwa.tagManager.currentTags.forEach((e) => {
        if(e.config.name=="Typos") return
        criteriaList.push(e.config.name)
        if(canvasClusters[e.config.options.group]==null) canvasClusters[e.config.options.group] = [e.config.name]
        else canvasClusters[e.config.options.group].push(e.config.name)
      })*/

      abwa.tagManager.currentTags.forEach((e) => {
    	  let tags = []
    	  e.tags.forEach((t) => {
    		  tags.push(t.name)
    	  })
    	  canvasClusters[e.config.name] = tags
      })
     /* allAnnotations.forEach((e) =>{
    	  if (canvasClusters["Other"] == null) canvasClusters["Other"] = [e.tags[1].replace('slr:code:', '')]
    	  else canvasClusters["Other"].push(e.tags[1].replace('slr:code:', ''))
    	  criteriaList.push(e.tags[1].replace('slr:code:', ''))
      })*/
      /*review.annotations.forEach((e) => {
        if(e.criterion=="Typos"||criteriaList.indexOf(e.criterion)!=-1) return
        if(canvasClusters["Other"]==null) canvasClusters["Other"] = [e.criterion]
        else canvasClusters["Other"].push(e.criterion)
        criteriaList.push(e.criterion)
      })*/

      let clusterTemplate = document.querySelector("#propertyClusterTemplate")
      let columnTemplate = document.querySelector("#clusterColumnTemplate")
      let propertyTemplate = document.querySelector("#clusterPropertyTemplate")
      let annotationTemplate = document.querySelector("#annotationTemplate")
      //let clusterHeight = 100.0/Object.keys(canvasClusters).length

      /*let getCriterionLevel = (annotations) => {
        if(annotations.length===0) return 'emptyCluster'
        if(annotations[0].level==null||annotations[0].level=='') return 'unsorted'
        let criterionLevel = annotations[0].level
        for(let i=1;i<annotations.length;i++){
          if(annotations[i].level==null||annotations[i].level=='') return 'unsorted'
          else if(annotations[i].level!=criterionLevel) return 'unsorted'
        }
        return criterionLevel.replace(/\s/g,'')
      }*/

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

      let getGroupAnnotationCount = (group) => {
        let i = 0
        canvasClusters[group].forEach((e) => {i += allAnnotations.filter((a) => {return a.tags[1].replace('slr:code:','')===e}).length})
        return i
      }
      let getColumnAnnotationCount = (properties) => {
        let i = 0
        properties.forEach((e) => {i += allAnnotations.filter((a) => {return a.tags[1].replace('slr:code:','')===e}).length})
        return i
      }
      let getGroupHeight = (group) => {
        if(allAnnotations.length===0) return 33.3333
        return 15.0+getGroupAnnotationCount(group)*(100.0-15*Object.keys(canvasClusters).length)/allAnnotations.length
      }
      let getColumnWidth = (properties,group) => {
        let colNum = canvasClusters[group].length===2 ? 2 : Math.ceil(canvasClusters[group].length/2)
        if(getGroupAnnotationCount(group)===0) return 100.0/Math.ceil(canvasClusters[group].length/2)
        return 15.0+getColumnAnnotationCount(properties)*(100.0-15*colNum)/getGroupAnnotationCount(group)
      }
      let getPropertyHeight = (property,properties) => {
        if(properties.length==1) return 100
        if(getColumnAnnotationCount(properties)==0&&properties.length==2) return 50
        return 15.0+allAnnotations.filter((e)=>{return e.tags[1].replace('slr:code:','')===property}).length*(100.0-15*2)/getColumnAnnotationCount(properties)
      }

      for (let i = 0, len = criteriaList.length; i < len; i++) {
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
        	  /*/if (j % 2 == 0 || canvasClusters[criteriaList[i]].length == 2) {
        		  currentColumn = columnTemplate.content.cloneNode(true)
        		  if (canvasClusters[criteriaList[i]].length == 1) {
        			  //currentColumn.querySelector('.clusterContainer').style.width = "100%"
        		  } else {
        			  //let columnWidth
        			  //if (canvasClusters[criteriaList[i]].length == 2) columnWidth = getColumnsWidth([canvasClusters[criteriaList[i]][j]], criteriaList[i])
        			  //else if (i < canvasClusters[criteriaList[i]].length - 1) columnWidth = getColumnWidth([canvasClusters[criteriaList[i]][j], canvasClusters[criteriaList[i]][j+1]], criteriaList[i])
        			  //else columnWidth = getColumnWidth([canvasClusters[criteriaList[i]][j]], criteriaList[i])
        			  //currentColumn.querySelector('.clusterColumn').style.width = columnWidth+'%'
        		  }
        	  }*/
        	  currentColumn = columnTemplate.content.cloneNode(true)
        	  percentage = 100 / canvasClusters[criteriaList[i]].length
        	  currentColumn.querySelector('.clusterColumn').style.width = percentage + '%'
              let clusterProperty = propertyTemplate.content.cloneNode(true)
              clusterProperty.querySelector(".propertyLabel").innerText = canvasClusters[criteriaList[i]][j]
              let propertyHeight = 100 / canvasClusters.facet.length
              //if(canvasClusters[criteriaList[i]].length==2) propertyHeight = getPropertyHeight(canvasClusters[criteriaList[i]][j],[canvasClusters[criteriaList[i]][j]])
              //else if(i % 2 == 0 && i < canvasClusters[criteriaList[i]].length-1) propertyHeight = getPropertyHeight(canvasClusters[criteriaList[i]][j],[canvasClusters[criteriaList[i]][j],canvasClusters[criteriaList[i]][j+1]])
              //else if(i % 2 == 1) propertyHeight = getPropertyHeight(canvasClusters[criteriaList[i]][j],[canvasClusters[criteriaList[i]][j],canvasClusters[criteriaList[i]][j-1]])
              clusterProperty.querySelector(".clusterProperty").style.height = '100%'
              clusterProperty.querySelector(".clusterProperty").style.width = "100%";
              let criterionAnnotations = allAnnotations.filter((e) => {return e.tags[1].replace('slr:code:', '') === canvasClusters[criteriaList[i]][j]})
              if(criterionAnnotations.length == 0) clusterProperty.querySelector('.propertyAnnotations').style.display = 'none'
            	  
              let annotationWidth = 100.0/criterionAnnotations.length
              for(let k=0; k<criterionAnnotations.length; k++){
            	 debugger
                 let annotationElement = annotationTemplate.content.cloneNode(true)
                 annotationElement.querySelector('.canvasAnnotation').style.width = annotationWidth+'%'
                 annotationElement.querySelector('.canvasAnnotation').innerText = '"'+criterionAnnotations[j].target[0].selector[3].exact+'"'
                 let facetTag = _.find(criterionAnnotations[k].tags, (tag) => {
               	  return tag.includes(Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.relation + ':')
                 })
                 if (facetTag) {
                	 let facetName = facetTag.replace(Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.relation + ':', '')
                     let facet = _.find(window.abwa.specific.mappingStudyManager.mappingStudy.facets, (facet) => { return facet.name === facetName })
                     if (facet.multivalued || facet.monovalued)	 annotationElement.querySelector('.canvasAnnotation').className += ' Strength'
                     else annotationElement.querySelector('.canvasAnnotation').className += ' unsorted'
                 } else {
                	 let facetName = facetTag.replace(Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.statics.validated, '')
                     let facet = _.find(window.abwa.specific.mappingStudyManager.mappingStudy.facets, (facet) => { return facet.name === facetName })
                     if (facet) annotationElement.querySelector('.canvasAnnotation').className += ' Strength'
                     else annotationElement.querySelector('.canvasAnnotation').className += ' unsorted'
                 }
                 /*annotationElement.querySelector('.canvasAnnotation').addEventListener('click',function(){
                   displayAnnotation(criterionAnnotations[k])
                 })*/
                 clusterProperty.querySelector('.propertyAnnotations').appendChild(annotationElement)
              }

              currentColumn.querySelector('.clusterColumn').appendChild(clusterProperty)
              /*if(i%2==1||i==canvasClusters[criteriaList[i]].length-1||canvasClusters[criteriaList[i]].length==2)*/ clusterContainer.appendChild(currentColumn)
            }
            canvasContainer.appendChild(clusterElement)
    	  
      }
      /*for(let key in canvasClusters){
        let clusterElement = clusterTemplate.content.cloneNode(true)
        //clusterElement.querySelector(".propertyCluster").style.height = clusterHeight+'%'
        clusterElement.querySelector(".propertyCluster").style.height = getGroupHeight(key)+'%'
        clusterElement.querySelector(".clusterLabel span").innerText = key
        let clusterContainer = clusterElement.querySelector('.clusterContainer')
        let currentColumn = null
        for(let i=0;i<canvasClusters[key].length;i++){
          if(i%2==0||canvasClusters[key].length==2){
            currentColumn = columnTemplate.content.cloneNode(true)
            if(canvasClusters[key].length==1) currentColumn.querySelector('.clusterColumn').style.width = "100%"
            /*else if(canvasClusters[key].length==2) currentColumn.querySelector('.clusterColumn').style.width = "50%"
            else currentColumn.querySelector('.clusterColumn').style.width = parseFloat(100.0/Math.ceil(canvasClusters[key].length/2)).toString()+'%'*/
           /*else{
              let columnWidth
              if(canvasClusters[key].length == 2) columnWidth = getColumnWidth([canvasClusters[key][i]],key)
              else if(i < canvasClusters[key].length-1) columnWidth = getColumnWidth([canvasClusters[key][i],canvasClusters[key][i+1]],key)
              else columnWidth = getColumnWidth([canvasClusters[key][i]],key)
              currentColumn.querySelector('.clusterColumn').style.width = columnWidth+'%'
            }
          }
          let clusterProperty = propertyTemplate.content.cloneNode(true)
          clusterProperty.querySelector(".propertyLabel").innerText = canvasClusters[key][i]
          /*if(canvasClusters[key].length==1||canvasClusters[key].length==2||(canvasClusters[key].length%2==1&&i==canvasClusters[key].length-1)) clusterProperty.querySelector(".clusterProperty").style.height = "100%"
          else clusterProperty.querySelector(".clusterProperty").style.height = "50%";*/
          /*let propertyHeight = 100
          if(canvasClusters[key].length==2) propertyHeight = getPropertyHeight(canvasClusters[key][i],[canvasClusters[key][i]])
          else if(i%2==0&&i<canvasClusters[key].length-1) propertyHeight = getPropertyHeight(canvasClusters[key][i],[canvasClusters[key][i],canvasClusters[key][i+1]])
          else if(i%2==1) propertyHeight = getPropertyHeight(canvasClusters[key][i],[canvasClusters[key][i],canvasClusters[key][i-1]])
          clusterProperty.querySelector(".clusterProperty").style.height = propertyHeight+'%'
          clusterProperty.querySelector(".clusterProperty").style.width = "100%";

          let criterionAnnotations = allAnnotations.filter((e) => {return e.tags[1].replace('slr:code:', '') === canvasClusters[key][i]})
          if(criterionAnnotations.length==0) clusterProperty.querySelector('.propertyAnnotations').style.display = 'none'
          //clusterProperty.querySelector('.clusterProperty').className += ' '+getCriterionLevel(criterionAnnotations)

          let annotationWidth = 100.0/criterionAnnotations.length
          for(let j=0;j<criterionAnnotations.length;j++){
            let annotationElement = annotationTemplate.content.cloneNode(true)
            annotationElement.querySelector('.canvasAnnotation').style.width = annotationWidth+'%'
            if(criterionAnnotations[j].highlightText!=null) annotationElement.querySelector('.canvasAnnotation').innerText = '"'+criterionAnnotations[j].highlightText+'"'
            if(criterionAnnotations[j].level!=null) annotationElement.querySelector('.canvasAnnotation').className += ' '+criterionAnnotations[j].level.replace(/\s/g,'')
            else annotationElement.querySelector('.canvasAnnotation').className += ' unsorted'
            annotationElement.querySelector('.canvasAnnotation').addEventListener('click',function(){
              displayAnnotation(criterionAnnotations[j])
            })
            clusterProperty.querySelector('.propertyAnnotations').appendChild(annotationElement)
          }

          currentColumn.querySelector('.clusterColumn').appendChild(clusterProperty)
          if(i%2==1||i==canvasClusters[key].length-1||canvasClusters[key].length==2) clusterContainer.appendChild(currentColumn)
        }
        canvasContainer.appendChild(clusterElement)
      }*/
      Alerts.closeAlert()
    })
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