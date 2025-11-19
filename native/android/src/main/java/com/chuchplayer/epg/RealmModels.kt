package com.chuchplayer.epg

import io.realm.RealmObject
import io.realm.annotations.Index
import io.realm.annotations.PrimaryKey
import java.util.Date

// Realm model matching the JS Program schema
open class ProgramRealm : RealmObject() {
    @PrimaryKey
    var id: String = ""
    
    @Index
    var playlistId: String = ""
    
    @Index
    var channelId: String = ""
    
    var title: String = ""
    var description: String? = null
    
    @Index
    var start: Date = Date()
    
    @Index
    var end: Date = Date()
    
    var epgChannelId: String? = null
    var createdAt: Date = Date()
}

// Realm model matching the JS Metadata schema
open class MetadataRealm : RealmObject() {
    @PrimaryKey
    var playlistId: String = ""
    var lastUpdated: Date = Date()
    var sourceSignature: String? = null
}

