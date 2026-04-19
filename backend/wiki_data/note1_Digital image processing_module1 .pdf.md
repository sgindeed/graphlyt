# note1_Digital image processing_module1 .pdf

Digital Image Processing
Prepared By ,
Sanjukta Mishra(SJM)
Assistant Professor
CST & CSIT

UNIT I
Introduction
•Overview
•Digital Image Representation
•Fundamental Steps in Image Processing
•Elements of Digital Image Processing

•Adigital image isarepresentation ofatwo-
dimensional image asafinite setofdigital values, called
picture elements orpixels
What is Digital Image?

•Pixel values typically represent gray levels, colours,
heights, opacities etc
•Digitization implies that adigital image is an
approximation ofarealscene
1pixelWhat is Digital Image?

Common image formats include:
1sample perpoint (B&W orGrayscale)
3samples perpoint (Red, Green, andBlue)
4samples perpoint (Red, Green, Blue, and“Alpha”,
a.k.a.Opacity)
What is Digital Image?

•Animage canbedefined asatwo-dimensional 
function f(x,y)
•x,y:Spatial coordinate
•f:theamplitude ofanypairofcoordinate x,y,which 
is called the intensity or gray level of the image at 
thatpoint.
•X,yandf,areallfinite anddiscrete quantities.Digital Image definition

•Digital image processing focuses ontwomajor tasks
a.Improvement of pictorial information forhuman 
interpretation .
b.Processing ofimage data forstorage, transmission 
and representation for autonomous machine 
perception
•Some argument about where image processing ends and
fields such asimage analysis andcomputer vision startWhat is Digital Image Processing?

The continuum from image processing tocomputer
vision canbebroken upinto low-,mid-andhigh-
level processesWhat is Digital Image Processing?

•Early 1920s: One ofthefirstapplications ofdigital 
imaging wasinthenews -
paper industry
–TheBartlane cable picture
transmission service
–Images were transferred bysubmarine cable
between London andNew Y ork
–Pictures were coded forcable transfer and
reconstructed atthereceiving endonatelegraph
printer
History Of Digital Image Processing

•Mid tolate 1920s: Improvements tothe Bartlane
system resulted inhigher quality images
–New reproduction 
processes based 
on photographic 
techniques
–Increased number 
oftones in
reproduced 
images
Improved
digital image Early 15tone digital imageHistory Of Digital Image Processing

•1960s: Improvements incomputing technology and
the onset ofthespace race ledtoasurge of work in
digital image processing
–1964: Computers used to 
improve the quality of 
images ofthemoon taken 
bytheRanger 7probe
–Such techniques were used 
inother space missions
includingtheApollolanding s
Apicture ofthemoon taken by 
theRanger 7probe minutes 
before landingHistory Of Digital Image Processing

•1970 s:Digital image processing begins tobeused
inmedical applications
–1979 :Sir Godfrey N.
Hounsfield &Prof.Allan M.
Cormack share the Nobel
Prize inmedicine forthe
invention of tomography,
the technology behind
Computerized Axial
Tomography (CA T) scans
Typical head slice CA Timage
History Of Digital Image Processing

•1980s -Today: The use of digital image processing 
techniques hasexploded andthey arenow used forall 
kinds oftasks inallkinds ofareas
–Image enhancement/restoration
–Artistic effects
–Medical visualisation
–Industrial inspection
–Law enforcement
–Human computer interfacesHistory Of Digital Image Processing

•1980s -Today: The use of digital image processing 
techniques hasexploded andthey arenow used forall 
kinds oftasks inallkinds ofareas
–Image enhancement/restoration
–Artistic effects
–Medical visualisation
–Industrial inspection
–Law enforcement
–Human computer interfacesHistory Of Digital Image Processing

•Computer Graphics :Thecreation ofimages
•Image Processing :Enhancement orother
manipulation oftheimage
•Computer Vision :Analysis oftheimage contentImage Processing Fields

Input / 
OutputImage Description
Image Image 
ProcessingComputer  
Vision
Description Computer  
GraphicsAIImage Processing Fields

•Low -Level Processes :
a)Input andoutput areimages
b)Tasks :Primitive operations, such as,image
processing toreduce noise, contrast enhancement
andimage sharpening .Computerized Processes Types

•Mid-Level Processes:
a)Inputs ,generally, areimages .Outputs are
attributes extracted from those images (edges,
contours, identity ofindividual objects)
b)Tasks :
•Segmentation (partitioning animage into
regions orobjects)
•Description ofthose objects toreduce them toa
form suitable forcomputer processing
•Classifications (recognition) ofobjectsComputerized Processes Types

•High -Level Processes:
–Image analysis andcomputer visionComputerized Processes Types

Fundamental Steps in Digital Image Processing

Step 1:ImageAcquisition
Theimage iscaptured byasensor (eg.Camera), anddigitized
Iftheoutput ofthecamera orsensor isnot already indigital
form, using analog -to-digital convertorFundamental Steps in Digital Image Processing

Step 2:Image Enhancement
The process ofmanipulating animage sothat the
result ismore suitable than theoriginal forspecific
applications .
The idea behind enhancement techniques istobring
outdetails that arehidden, orsimple tohighlight
certain features ofinterest inanimage .Fundamental Steps in Digital Image Processing

Step 3:Image Restoration
a)Improving theappearance ofanimage
b)Tend tobemathematical orprobabilistic models .
Enhancement, ontheother hand, isbased onhuman
subjective preferences regarding what constitutes a
“good” enhancement result .Fundamental Steps in Digital Image Processing

Step 4:Morphological Processing
Tools forextracting image components thatareuseful in
therepresentation anddescription ofshape.
In this step, there would be a transition from processes
thatoutput images, toprocesses thatoutput image
attributes.Fundamental Steps in Digital Image Processing

Step 5:Image Segmentation
Segmentation procedures partition animage intoits 
constituent parts orobjects.Fundamental Steps in Digital Image Processing

Step 6:Representation andDescription
Representation: Make a decision whether the data 
should berepresented asaboundary orasacomplete 
region. It is almost always follows the output of a 
segmentation stage .
Boundary Representation: Focus onexternal 
shape characteristics, such as corners and inflections
Region Representation: Focus on internal 
properties, such astexture orskeleton shapeFundamental Steps in Digital Image Processing

Step 6:Representation andDescription
Choosing a representation is only part of the solution 
for transforming raw data into a form suitable for 
subsequent computer processing (mainly recognition)
Description: also called, feature selection , deals 
with extracting attributes thatresult insome
information of interest.Fundamental Steps in Digital Image Processing

Step 7:Recognition andInterpretation
Recognition: theprocess thatassigns label toan 
object based on the information provided by its 
description.Fundamental Steps in Digital Image Processing

Knowledge Base
Knowledge about aproblem domain iscoded intoan
image processing system intheform ofaknowledge
database .Fundamental Steps in Digital Image Processing

Color Image Processing
Usethecolour oftheimage toextract features of
interest inanimageFundamental Steps in Digital Image Processing

Compression
Techniques forreducing thestorage required tosave 
animage orthebandwidth required totransmit it.Fundamental Steps in Digital Image Processing

Network
Image displays Computer Mass storage
HardcopySpecialized image 
processing hardwareImage processing 
software
Image sensorsProblem DomainTypicalgeneral-
purpose DIP 
systemComponents of Digital Image Processing

1.Image Sensors
Two elements arerequired toacquire digital
images .
Thefirstisthephysical device thatissensitive to
the energy radiated bytheobject wewish to
image (Sensor ).
The second, called adigitizer ,isadevice for
converting theoutput ofthephysical sensing
device intodigital form .Components of Digital Image Processing

2.Specialized Image Processing Hardware
Consists ofthe digitizer plus hardware that
performs other primitive operations, such asan
arithmetic logic unit (ALU), which performs
arithmetic andlogical operations inparallel on
entire images .
This type ofhardware sometimes iscalled afront
endsubsystem
Itsmost distinguishing characteristic isspeed .In
other words, this unit performs functions that
require fastdata throughputs thatthetypical main
computer cannot handle .Components of Digital Image Processing

3.Computer
Thecomputer inanimage processing system isa
general -purpose computer andcanrange from a
PCtoasupercomputer .
Indedicated applications, sometimes specially
designed computers are used to achieve a
required level ofperformance .Components of Digital Image Processing

4.Image Processing Software
Software for image processing consists of
specialized modules thatperform specific tasks .
A well-designed package also includes the
capability fortheuser towrite code that, asa
minimum, utilizes thespecialized modules .Components of Digital Image Processing

5.Mass Storage Capability
image ofsized 1024 *1024 pixels requires one
megabyte ofstorage space iftheimage isnot
compressed .
Digital storage forimage processing applications
falls intothree principal categories :
1.Short -term storage foruseduring processing .
2.onlinestorage forrelatively fastrecall
3.Archivalstorage,characterizedbyinfrequent
accessComponents of Digital Image Processing

5.Mass Storage Capability
One method ofproviding short -term storage iscomputer
memory .
Another isbyspecialized boards, called frame buffers,
that store one ormore images and can beaccessed
rapidly .
The on-line storage method, allows virtually
instantaneous image zoom, aswell asscroll (vertical
shifts) andpan(horizontal shifts) .
On-line storage generally takes theform ofmagnetic
disks and optical -media storage .The key factor
characterizing on-line storage isfrequent access tothe
stored data.

6.Image Displays
The displays inuse today aremainly color
(preferably flatscreen) TVmonitors .
Monitors are driven bytheoutputs ofthe
image andgraphics display cards that arean
integral partofacomputer system .Components of Digital Image Processing

7.Hardcopy devices
Used forrecording images, include laser printers,
film cameras, heat-sensitive devices, inkjet units and
digital units, such asoptical andCD-Rom disks .Components of Digital Image Processing

8.Networking
default function inanycomputer system, inuse
today .
Because ofthelarge amount ofdata inherent in
image processing applications the key
consideration in image transmission is
bandwidth .
Indedicated networks, this typically isnota
problem, butcommunications with remote sites
viatheinternet arenotalways asefficient .Components of Digital Image Processing

Image formation intheeye
Light receptor
radiant  
energyelectrical  
impulsesBrain

Pixels
Every pixel has #ofbits(k)
Q:Suppose a pixel has1bit,how many gray levels canitrepresent?
Answer: 2intensity levels only, black andwhite. Bit(0,1) 0:black ,1:white
Q:Suppose a pixel has2bit,how many gray levels canitrepresent? 
Answer: 4gray intensity levels ; 2Bit (00,01,10,11).
Q:wewant torepresent 256intensities of grayscale, how many bitsdoweneed?
Answer: 8bits;which represents: 28=256
the gray intensities ( L ) that the pixel can hold, is calculated according to 
according to number ofpixels ithas(k).L=2k

Number ofstorage ofbits:
N*M:theno.ofpixels inallthe 
image.
K:no.ofbitsineach pixel
L:grayscale levels thepixel can 
represent
L=2K
allbitsinimage= N*N*k

Number of
storage ofbits:
EX:Here: N=32, K=3, L=23=8
#ofpixels=N*N = 1024 .(because inthis example: M=N) 
#ofbits = N*N*K =1024*3= 3072
N=M inthistable, which means no.ofhorizontal pixels= no.ofvertical pixels. And 
thus:
#ofpixels intheimage= N*N

