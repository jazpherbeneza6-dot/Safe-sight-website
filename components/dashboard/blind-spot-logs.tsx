"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdmin } from "@/contexts/admin-context"
import { AlertTriangle, MapPin, Clock, Filter, User, Car, Shield, Bike, Dog, Database, Navigation, Map } from "lucide-react"

export function BlindSpotLogs() {
  const { blindSpotDetections, truckDrivers } = useAdmin()
  const [searchTerm, setSearchTerm] = useState("")
  const [severityFilter, setSeverityFilter] = useState<string>("all")

  const filteredDetections = blindSpotDetections.filter((detection) => {
    const matchesSearch =
      detection.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      detection.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (detection.placeName && detection.placeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (detection.direction && detection.direction.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (detection.alertLevel && detection.alertLevel.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesSeverity = severityFilter === "all" || detection.severity === severityFilter

    return matchesSearch && matchesSeverity
  })

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive"
      case "high":
        return "destructive"
      case "medium":
        return "secondary"
      case "low":
        return "outline"
      default:
        return "outline"
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🔴"
      case "high":
        return "🟠"
      case "medium":
        return "🟡"
      case "low":
        return "🟢"
      default:
        return "⚪"
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "person":
        return <User className="h-4 w-4" />
      case "vehicle":
        return (
          <img
            src="/icon 1.png"
            alt="Vehicle"
            className="object-contain w-full h-full"
            style={{ 
              display: 'block'
            }}
            onError={(e) => {
              console.error('Failed to load vehicle icon:', e.currentTarget.src)
            }}
          />
        )
      case "barrier":
        return <Shield className="h-4 w-4" />
      case "cyclist":
        return <Bike className="h-4 w-4" />
      case "animal":
        return <Dog className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`
  }

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Show empty state if no drivers exist
  if (truckDrivers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-muted/50 backdrop-blur-sm px-4 py-2 rounded-xl border border-border/50">
            <div className="w-2 h-2 bg-chart-1 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-muted-foreground">Detection System</span>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground via-chart-1 to-chart-2 bg-clip-text text-transparent">
            Blind Spot Detection Center
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Advanced safety monitoring with comprehensive blind spot detection logs and real-time alerts
          </p>
        </div>

        <Card className="border-0 shadow-2xl bg-gradient-to-br from-card to-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center max-w-md space-y-6">
              <div className="bg-gradient-to-br from-chart-1 to-chart-2 p-6 rounded-xl w-20 h-20 mx-auto flex items-center justify-center shadow-lg">
                <AlertTriangle className="h-10 w-10 text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-foreground">No Detection System Active</h3>
                <p className="text-muted-foreground">
                  Blind spot detection logs will appear here once you have drivers and vehicles with detection systems
                  installed.
                </p>
              </div>
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                Add drivers in <span className="text-foreground font-medium">Account Management</span> to start monitoring blind spot detections.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center space-y-2 sm:space-y-3">
        <div className="inline-flex items-center gap-2 bg-muted/50 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-xl border border-border/50">
          <div className="w-2 h-2 bg-chart-1 rounded-full animate-pulse"></div>
          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Detection System</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground via-chart-1 to-chart-2 bg-clip-text text-transparent">
          Blind Spot Detection Center
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto px-4">
          Monitor and analyze blind spot detection events in real-time
        </p>
      </div>

      {/* Enhanced Filters */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/80 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50 pb-3 sm:pb-4 px-3 sm:px-6">
          <CardTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg font-bold text-foreground">
            <div className="bg-gradient-to-br from-chart-1 to-chart-2 p-2 sm:p-2.5 rounded-lg shadow-lg shrink-0">
              <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
            </div>
            <span className="truncate">Advanced Filtering</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Search</label>
              <Input
                placeholder="Search by driver, place, direction, or alert level..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-2 border-border/80 focus:border-chart-1 focus:ring-2 focus:ring-chart-1/20 bg-input/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Severity</label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="border-2 border-border/80 focus:border-chart-1 focus:ring-2 focus:ring-chart-1/20 bg-input/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detection Logs */}
      <div className="space-y-3 sm:space-y-4">
        {filteredDetections.length === 0 ? (
          <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/80 backdrop-blur-sm overflow-hidden">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center max-w-md space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-muted/80 dark:bg-muted rounded-2xl shadow-xl mx-auto border border-border/50 p-4">
                  <img
                    src="/No detection.png"
                    alt="No Detection Logo"
                    width={64}
                    height={64}
                    className="object-contain w-16 h-16"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-foreground">No Detection Logs Available</h3>                 
                </div>                
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredDetections.map((detection) => (
            <Card key={detection.id} className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm hover:scale-[1.01]">
              <div className="absolute inset-0 bg-gradient-to-br from-chart-1/5 to-chart-2/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <CardContent className="relative p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
                  <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className={`rounded-lg shadow-lg shrink-0 flex items-center justify-center ${
                      detection.detectionType === "vehicle" 
                        ? "bg-gray-900 dark:bg-gray-800 w-10 h-10 sm:w-12 sm:h-12 p-1" 
                        : "bg-gradient-to-br from-chart-1 to-chart-2 p-2 sm:p-2.5 min-w-[2.5rem] min-h-[2.5rem] sm:min-w-[3rem] sm:min-h-[3rem]"
                    }`}>
                      {getTypeIcon(detection.detectionType)}
                    </div>
                      <div className="space-y-2 sm:space-y-3 flex-1 min-w-0">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {detection.alertLevel && (
                            <Badge 
                              variant={detection.alertLevel === "DANGER" ? "destructive" : "secondary"}
                              className={`font-medium text-[10px] sm:text-xs px-2 sm:px-3 py-1 shrink-0 ${
                                detection.alertLevel === "DANGER" 
                                  ? "bg-destructive/10 text-destructive border-destructive/20" 
                                  : "bg-muted"
                              }`}>
                              {detection.alertLevel}
                            </Badge>
                          )}
                          <Badge variant={getSeverityColor(detection.severity)} 
                            className={`font-medium text-[10px] sm:text-xs px-2 sm:px-3 py-1 shrink-0 ${
                              detection.severity === "critical" || detection.severity === "high" 
                                ? "bg-destructive/10 text-destructive border-destructive/20" 
                                : "bg-muted"
                            }`}>
                            {getSeverityIcon(detection.severity)} {detection.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">{detection.description}</p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs">
                        <div className="bg-muted/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1.5 sm:gap-2">
                          <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-chart-1 shrink-0" />
                          <span className="text-foreground font-medium truncate">{detection.driverName}</span>
                        </div>
                        {detection.direction && (
                          <div className="bg-muted/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1.5 sm:gap-2">
                            <Navigation className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-chart-3 shrink-0" />
                            <span className="text-foreground font-medium capitalize">{detection.direction}</span>
                          </div>
                        )}
                        {detection.placeName && (
                          <div className="bg-muted/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1.5 sm:gap-2">
                            <Map className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-chart-5 shrink-0" />
                            <span className="text-foreground font-medium truncate">{detection.placeName}</span>
                          </div>
                        )}
                        <div className="bg-muted/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1.5 sm:gap-2">
                          <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-chart-2 shrink-0" />
                          <span className="text-foreground font-mono text-[9px] sm:text-[10px] truncate">{formatCoordinates(detection.latitude, detection.longitude)}</span>
                        </div>
                        <div className="bg-muted/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1.5 sm:gap-2">
                          <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-chart-4 shrink-0" />
                          <span className="text-foreground">{getTimeAgo(detection.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right text-[10px] sm:text-xs bg-muted/50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shrink-0">
                    <div className="font-medium text-foreground">{detection.timestamp.toLocaleDateString()}</div>
                    <div className="text-muted-foreground">{detection.timestamp.toLocaleTimeString()}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
