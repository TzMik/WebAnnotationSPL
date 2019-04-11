class ContentAnnotator {
  openSidebar () {
    window.abwa.sidebar.openSidebar()
  }

  closeSidebar () {
    window.abwa.sidebar.closeSidebar()
  }
  //PVSCL:IFCOND(AllDeleter)
  deleteAllAnnotations(){}
  //PVSCL:ENDCOND
}

module.exports = ContentAnnotator
