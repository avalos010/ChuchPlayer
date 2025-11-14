package com.chuchplayer.epg

import io.realm.RealmObject
import io.realm.annotations.PrimaryKey
import java.util.Date

// Realm model matching the JS Program schema
open class ProgramRealm : RealmObject() {
    @PrimaryKey
    var id: String = ""
    var playlistId: String = ""
    var channelId: String = ""
    var title: String = ""
    var description: String? = null
    var start: Date = Date()
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

