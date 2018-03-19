@import 'common.js'

function framerize(context) {
    var layers = context.selection
    var doc = context.document
    
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i]
        var artboardName = layer.parentArtboard().name()
        var framerizedName = artboardName + "_" + layer.name() + "*"
        
        if (layer.class() != MSLayerGroup) {
            layer.select_byExpandingSelection(true, false)
            sketchAction.group(doc)
            var newGroup = layer.parentGroup()
            newGroup.setName(framerizedName)
        } else {
            layer.setName(framerizedName)
        }
    }
    doc.showMessage(layers.length + " layers framerized")
}
function refreshMirror(context) {
    // The Mirror sync problem only occurs when change things in Symbols page, so we just refresh layers in the page to remind Mirror to update
    var doc = context.document
    var pages = doc.pages()
    var pagePredicate = NSPredicate.predicateWithFormat("name == %@", "Symbols")
    var symbolPage = pages.filteredArrayUsingPredicate(pagePredicate).firstObject()
    var children = symbolPage.children()
    
    for (var i = 0; i < children.count(); i++) {
        var layer = children[i]
        var locked = layer.isLocked()
        layer.setIsLocked(!locked)
        layer.setIsLocked(locked)
    }
    doc.showMessage("Mirror refreshed")
}
function sortLayerList(context) {
    var doc = context.document
    var selection = context.selection
    
    if (selection.count() == 0) {
        // Sort Artboards
        var page = doc.currentPage()
        var artboards = page.artboards()
        var sortedArtboards = artboards.slice().sort(sortFromLeft_Top)
        for (var i = 0; i < sortedArtboards.length; i++) {
            var artboard = sortedArtboards[i]
            artboard.removeFromParent()
            page.insertLayer_atIndex(artboard, i)
        }
        doc.showMessage("Artboard's list sorted")
    } else {
        // Sort Layers
        var firstLayer = selection[0]
        var fromIndex = firstLayer.parentGroup().indexOfLayer(firstLayer)
        
        // Window with drop down menu
        var menu = ["by X", "by Y", "by X & Y"]
        var option = createDropdown("Sort Layer List", menu, 2)
        if (option.responseCode == 1001) {return}
        
        var sortedSelection = selection.slice().sort(sortFromRight_Bottom)
        switch (option.index) {
            case 0:
                sortedSelection = selection.slice().sort(sortX_FromRight)
                break
            case 1:
                sortedSelection = selection.slice().sort(sortY_FromBottom)
                break
            default:
                break
        }
        
        for (var i = 0; i < sortedSelection.length; i++) {
            var layer = sortedSelection[i]
            var parent = layer.parentGroup()
            layer.removeFromParent()
            parent.insertLayer_atIndex(layer, fromIndex + i)
        }
        doc.showMessage("Selection's list sorted")
    }
}

