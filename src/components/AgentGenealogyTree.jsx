import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitBranch, Dna, Shield, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AgentGenealogyTree({ agentName }) {
    const [genomes, setGenomes] = useState([]);
    const [selectedGenome, setSelectedGenome] = useState(null);
    const [patterns, setPatterns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadGenealogy();
    }, [agentName]);

    const loadGenealogy = async () => {
        try {
            setLoading(true);
            const allGenomes = await base44.entities.AgentGenome.filter({ agent_name: agentName });
            const sortedGenomes = allGenomes.sort((a, b) => a.generation - b.generation);
            setGenomes(sortedGenomes);

            const emergentPatterns = await base44.entities.EmergentPattern.list();
            const relevantPatterns = emergentPatterns.filter(p => 
                p.participants?.includes(agentName) && p.formalized_as
            );
            setPatterns(relevantPatterns);

            if (sortedGenomes.length > 0) {
                setSelectedGenome(sortedGenomes[sortedGenomes.length - 1]);
            }
        } catch (error) {
            console.error('Error loading genealogy:', error);
        } finally {
            setLoading(false);
        }
    };

    const buildTree = () => {
        const tree = [];
        const genomeMap = {};
        
        genomes.forEach(g => {
            genomeMap[g.id] = { ...g, children: [] };
        });

        genomes.forEach(g => {
            if (g.parent_genome_id && genomeMap[g.parent_genome_id]) {
                genomeMap[g.parent_genome_id].children.push(genomeMap[g.id]);
            } else {
                tree.push(genomeMap[g.id]);
            }
        });

        return tree;
    };

    const GenomeNode = ({ genome, depth = 0 }) => {
        const isSelected = selectedGenome?.id === genome.id;
        const isActive = genome.is_active;

        return (
            <div className={cn("ml-" + (depth * 8))}>
                <Button
                    variant={isSelected ? "default" : "ghost"}
                    className={cn(
                        "w-full justify-start mb-2",
                        isActive && "ring-2 ring-green-500"
                    )}
                    onClick={() => setSelectedGenome(genome)}
                >
                    <GitBranch className="mr-2 h-4 w-4" />
                    Gen {genome.generation}
                    {isActive && <Badge className="ml-2 bg-green-500">ACTIVE</Badge>}
                    <span className="ml-auto text-xs text-slate-400">
                        Fitness: {genome.fitness_score?.toFixed(1)}
                    </span>
                </Button>
                {genome.children?.map(child => (
                    <GenomeNode key={child.id} genome={child} depth={depth + 1} />
                ))}
            </div>
        );
    };

    if (loading) {
        return <div className="p-4 text-slate-400">Loading genealogy...</div>;
    }

    const tree = buildTree();

    return (
        <div className="grid grid-cols-2 gap-4 h-[600px]">
            <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                        <GitBranch className="h-5 w-5" />
                        Evolution Tree
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[480px]">
                        {tree.map(root => (
                            <GenomeNode key={root.id} genome={root} />
                        ))}
                    </ScrollArea>
                </CardContent>
            </Card>

            {selectedGenome && (
                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <Dna className="h-5 w-5" />
                            Generation {selectedGenome.generation} Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[480px]">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
                                        <TrendingUp className="h-4 w-4" />
                                        Fitness Score
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-slate-900 rounded-full h-2">
                                            <div 
                                                className="bg-green-500 h-2 rounded-full transition-all"
                                                style={{ width: `${(selectedGenome.fitness_score || 0)}%` }}
                                            />
                                        </div>
                                        <span className="text-slate-300">{selectedGenome.fitness_score?.toFixed(1)}</span>
                                    </div>
                                </div>

                                {selectedGenome.last_validation_score && (
                                    <div>
                                        <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
                                            <CheckCircle2 className="h-4 w-4" />
                                            Golden Master Validation
                                        </h4>
                                        <Badge className={cn(
                                            selectedGenome.last_validation_score >= 7 ? "bg-green-500" : "bg-red-500"
                                        )}>
                                            Score: {selectedGenome.last_validation_score?.toFixed(1)}/10
                                        </Badge>
                                    </div>
                                )}

                                <div>
                                    <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
                                        <Dna className="h-4 w-4" />
                                        Mutations
                                    </h4>
                                    {selectedGenome.mutations?.length > 0 ? (
                                        <div className="space-y-2">
                                            {selectedGenome.mutations.map((mut, idx) => (
                                                <div key={idx} className="bg-slate-900 rounded p-2">
                                                    <Badge variant="outline" className="mb-1">
                                                        {mut.type}
                                                    </Badge>
                                                    <p className="text-xs text-slate-300">{mut.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400">No mutations (base genome)</p>
                                    )}
                                </div>

                                <div>
                                    <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
                                        <Shield className="h-4 w-4" />
                                        Safety Constraints
                                    </h4>
                                    <div className="bg-slate-900 rounded p-3 text-xs">
                                        <pre className="text-slate-300 whitespace-pre-wrap">
                                            {JSON.stringify(selectedGenome.safety_constraints, null, 2)}
                                        </pre>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
                                        Active Protocols
                                    </h4>
                                    {patterns.length > 0 ? (
                                        <div className="space-y-2">
                                            {patterns.map(p => (
                                                <Badge key={p.id} variant="secondary">
                                                    {p.formalized_as}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400">No formalized protocols</p>
                                    )}
                                </div>

                                <div>
                                    <h4 className="font-semibold text-white mb-2">
                                        Instruction DNA
                                    </h4>
                                    <ScrollArea className="h-32 bg-slate-900 rounded p-3">
                                        <p className="text-xs text-slate-300 whitespace-pre-wrap">
                                            {selectedGenome.instruction_dna}
                                        </p>
                                    </ScrollArea>
                                </div>
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}