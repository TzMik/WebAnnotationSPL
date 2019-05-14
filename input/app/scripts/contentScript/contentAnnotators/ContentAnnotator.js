class ContentAnnotator {
  openSidebar () {
    window.abwa.sidebar.openSidebar()
  }

  closeSidebar () {
    window.abwa.sidebar.closeSidebar()
  }
  //PVSCL:IFCOND(AllDeleter, LINE)
  deleteAllAnnotations(){}
  //PVSCL:ENDCOND
}

module.exports = ContentAnnotator
