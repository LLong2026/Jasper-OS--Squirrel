import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Car, Brain, Target, Loader2, Zap } from 'lucide-react';
import { fetchTeslaIncidentData } from '@/functions/fetchTeslaIncidentData';
import { analyzeAutonomousFailure } from '@/functions/analyzeAutonomousFailure';
import { generateTrainingScenarios } from '@/functions/generateTrainingScenarios';

export default function TeslaFSDSolver() {
  const [incidentData, setIncidentData] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [trainingScenarios, setTrainingScenarios] = useState(null);
  const [selectedFailureType, setSelectedFailureType] = useState('');
  const [isLoading, setIsLoading] = useState({
    incidents: false,
    analysis: false,
    scenarios: false
  });

  const handleFetchIncidents = async () => {
    setIsLoading(prev => ({ ...prev, incidents: true }));
    try {
      const response = await fetchTeslaIncidentData({ 
        data_sources: ['NHTSA', 'social_media', 'beta_testers'], 
        time_window: '30 days' 
      });
      setIncidentData(response);
    } catch (error) {
      console.error("Error fetching Tesla incident data:", error);
    }
    setIsLoading(prev => ({ ...prev, incidents: false }));
  };

  const handleAnalyzeFailure = async () => {
    if (!incidentData || !selectedFailureType) return;
    setIsLoading(prev => ({ ...prev, analysis: true }));
    try {
      const response = await analyzeAutonomousFailure({
        incident_data: incidentData.data,
        failure_type: selectedFailureType
      });
      setAnalysisResult(response);
    } catch (error) {
      console.error("Error analyzing failure:", error);
    }
    setIsLoading(prev => ({ ...prev, analysis: false }));
  };

  const handleGenerateScenarios = async () => {
    if (!selectedFailureType) return;
    setIsLoading(prev => ({ ...prev, scenarios: true }));
    try {
      const response = await generateTrainingScenarios({
        edge_case_type: selectedFailureType,
        scenario_count: 15,
        complexity_level: 'Expert'
      });
      setTrainingScenarios(response);
    } catch (error) {
      console.error("Error generating scenarios:", error);
    }
    setIsLoading(prev => ({ ...prev, scenarios: false }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black text-white">
      <div className="container mx-auto px-6 py-8">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Car className="h-12 w-12 text-red-500" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-red-500 to-white bg-clip-text text-transparent">
              Tesla FSD Edge Case Resolver
            </h1>
          </div>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Systematic AI solution to accelerate Tesla's Full Self-Driving deployment by identifying, analyzing, and solving edge cases faster than humanly possible.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Step 1: Data Collection */}
          <Card className="bg-slate-800/50 border-slate-700 hover:border-red-500/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                1. Intelligence Gathering
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-300 text-sm">
                Deploy TeslaFSDOracle to monitor real-world FSD incidents across NHTSA reports, social media, and beta tester feedback.
              </p>
              <Button 
                onClick={handleFetchIncidents}
                disabled={isLoading.incidents}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {isLoading.incidents ? <Loader2 className="animate-spin" /> : "Fetch Live Incident Data"}
              </Button>
              {incidentData && (
                <div className="text-xs text-green-400 bg-green-400/10 p-2 rounded">
                  ✓ Found {incidentData.data?.total_incidents || 'N/A'} incidents in past 30 days
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Failure Analysis */}
          <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Brain className="h-5 w-5" />
                2. Root Cause Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedFailureType} onValueChange={setSelectedFailureType}>
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue placeholder="Select failure type to analyze" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="construction_zones">Construction Zone Navigation</SelectItem>
                  <SelectItem value="emergency_vehicles">Emergency Vehicle Response</SelectItem>
                  <SelectItem value="pedestrian_crossing">Pedestrian Crossing Edge Cases</SelectItem>
                  <SelectItem value="weather_conditions">Adverse Weather Handling</SelectItem>
                  <SelectItem value="parking_lots">Parking Lot Navigation</SelectItem>
                  <SelectItem value="highway_merging">Highway Merging Failures</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAnalyzeFailure}
                disabled={isLoading.analysis || !incidentData || !selectedFailureType}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading.analysis ? <Loader2 className="animate-spin" /> : "Analyze Failure Mode"}
              </Button>
              {analysisResult && (
                <div className="text-xs text-green-400 bg-green-400/10 p-2 rounded">
                  ✓ Technical solution generated with {Math.round(analysisResult.confidence_score * 100)}% confidence
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Training Generation */}
          <Card className="bg-slate-800/50 border-slate-700 hover:border-green-500/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-400">
                <Target className="h-5 w-5" />
                3. Solution Implementation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-300 text-sm">
                Generate targeted training scenarios to eliminate the identified edge case failure mode.
              </p>
              <Button 
                onClick={handleGenerateScenarios}
                disabled={isLoading.scenarios || !selectedFailureType}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isLoading.scenarios ? <Loader2 className="animate-spin" /> : "Generate Training Scenarios"}
              </Button>
              {trainingScenarios && (
                <div className="text-xs text-green-400 bg-green-400/10 p-2 rounded">
                  ✓ Generated {trainingScenarios.training_scenarios?.scenarios?.length || 0} expert-level scenarios
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results Display */}
        <div className="space-y-8">
          {analysisResult && (
            <Card className="bg-slate-800/30 border-slate-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-300">
                  <Brain className="h-6 w-6" />
                  Technical Solution Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-red-400 mb-2">Root Cause</h3>
                    <p className="text-sm text-slate-300">{analysisResult.analysis?.root_cause?.primary_failure}</p>
                    <ul className="text-xs text-slate-400 mt-2 space-y-1">
                      {analysisResult.analysis?.root_cause?.contributing_factors?.map((factor, i) => (
                        <li key={i}>• {factor}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-400 mb-2">Implementation Timeline</h3>
                    <div className="text-sm space-y-1">
                      <div><span className="text-red-300">Elon Time:</span> {analysisResult.analysis?.implementation?.elon_timeline}</div>
                      <div><span className="text-green-300">Reality:</span> {analysisResult.analysis?.implementation?.realistic_timeline}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="font-semibold text-blue-400 mb-2">Technical Solution</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Neural Network Updates:</strong>
                      <ul className="text-slate-300 mt-1 space-y-1">
                        {analysisResult.analysis?.technical_solution?.neural_network_changes?.map((change, i) => (
                          <li key={i} className="text-xs">• {change}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong>Sensor Improvements:</strong>
                      <ul className="text-slate-300 mt-1 space-y-1">
                        {analysisResult.analysis?.technical_solution?.sensor_improvements?.map((improvement, i) => (
                          <li key={i} className="text-xs">• {improvement}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {trainingScenarios && (
            <Card className="bg-slate-800/30 border-slate-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-300">
                  <Target className="h-6 w-6" />
                  Generated Training Scenarios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {trainingScenarios.training_scenarios?.scenarios?.slice(0, 6).map((scenario, i) => (
                    <Card key={i} className="bg-slate-700/50 border-slate-600">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-white">{scenario.name}</CardTitle>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">{scenario.scenario_id}</span>
                          <div className="flex items-center gap-1">
                            <Zap className="h-3 w-3 text-yellow-400" />
                            <span className="text-xs text-yellow-400">{scenario.difficulty_score}/10</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 text-xs">
                          <div>
                            <strong className="text-blue-300">Environment:</strong>
                            <p className="text-slate-300">{scenario.environment?.road_type}, {scenario.environment?.weather}</p>
                          </div>
                          <div>
                            <strong className="text-red-300">Edge Case:</strong>
                            <p className="text-slate-300">{scenario.edge_case_trigger}</p>
                          </div>
                          <div>
                            <strong className="text-green-300">Solution:</strong>
                            <p className="text-slate-300">{scenario.correct_response}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-green-400/10 rounded-lg">
                  <p className="text-sm text-green-300">
                    <strong>Implementation Value:</strong> {trainingScenarios.training_scenarios?.estimated_training_value}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}